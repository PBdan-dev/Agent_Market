import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { detectArchiveExtension, downloadFilename, findManifest, listArchiveEntries } from "@/lib/archive";
import { manifestSchema, manifestToAgentFields } from "@/lib/manifest";
import { slugify } from "@/lib/slug";
import { agentSchema, parseTagList } from "@/lib/validation";
import { buildZip } from "@/lib/zip-build";
import resumeur from "../examples/resumeur-documents/agent.json";
import questions from "../examples/questions-dossier/agent.json";
import mesh from "../examples/mesh-blender/agent.json";

const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
const GZIP = new Uint8Array([0x1f, 0x8b, 0x08, 0x00]);

// Construit une archive tar (format ustar minimal) pour les tests.
function buildTar(files: Record<string, string>): Buffer {
  const blocks: Buffer[] = [];
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100);
    header.write("0000644\0", 100);
    header.write(data.length.toString(8).padStart(11, "0") + "\0", 124);
    header.write("0", 156);
    header.write("ustar\0", 257);
    header.write("00", 263);
    header.fill(" ", 148, 156);
    const sum = header.reduce((a, b) => a + b, 0);
    header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
    blocks.push(header, data, Buffer.alloc(Math.ceil(data.length / 512) * 512 - data.length));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

describe("slugify", () => {
  it("retire accents et ponctuation", () => {
    expect(slugify("Agent Gmail — Édition Pro !")).toBe("agent-gmail-edition-pro");
    expect(slugify("3D & création")).toBe("3d-creation");
  });
});

describe("detectArchiveExtension", () => {
  it("accepte zip et tar.gz dont la signature correspond", () => {
    expect(detectArchiveExtension("agent.zip", ZIP)).toBe(".zip");
    expect(detectArchiveExtension("agent.TAR.GZ", GZIP)).toBe(".tar.gz");
    expect(detectArchiveExtension("agent.tgz", GZIP)).toBe(".tgz");
  });
  it("refuse une extension ou une signature non conforme", () => {
    expect(detectArchiveExtension("agent.exe", ZIP)).toBeNull();
    expect(detectArchiveExtension("agent.zip", GZIP)).toBeNull();
    expect(detectArchiveExtension("agent.zip", new TextEncoder().encode("#!/bin"))).toBeNull();
  });
});

describe("listArchiveEntries", () => {
  it("liste les fichiers d'un zip et repère agent.json", () => {
    const zip = buildZip({ "mon-agent/agent.json": "{}", "mon-agent/README.md": "# x", "mon-agent/prompts/system.md": "…", "__MACOSX/._x": "" });
    const entries = listArchiveEntries(zip, ".zip");
    expect(entries).toEqual(["mon-agent/agent.json", "mon-agent/README.md", "mon-agent/prompts/system.md"]);
    expect(findManifest(entries)).toBe("mon-agent/agent.json");
  });
  it("liste les fichiers d'un tar.gz", () => {
    const tgz = gzipSync(buildTar({ "agent.json": "{}", "src/main.py": "print(1)" }));
    const entries = listArchiveEntries(new Uint8Array(tgz), ".tgz");
    expect(entries).toEqual(["agent.json", "src/main.py"]);
    expect(findManifest(entries)).toBe("agent.json");
  });
  it("ne considère pas un agent.json enfoui comme manifeste", () => {
    expect(findManifest(["a/b/agent.json", "a/README.md"])).toBeUndefined();
  });
  it("rejette un zip tronqué", () => {
    expect(() => listArchiveEntries(ZIP, ".zip")).toThrow();
  });
});

describe("downloadFilename", () => {
  it("neutralise les caractères dangereux de la version", () => {
    expect(downloadFilename("agent-gmail", '1.0"; x', ".zip")).toBe("agent-gmail-1.0___x.zip");
  });
});

describe("parseTagList", () => {
  it("découpe, dédoublonne et limite à 5", () => {
    expect(parseTagList(" Python, python ,LangChain,, a,b,c,d")).toEqual(["Python", "LangChain", "a", "b", "c"]);
  });
});

describe("agentSchema", () => {
  const base = {
    name: "Agent test",
    summary: "Un agent pour tester.",
    objective: "Vérifier que la validation du formulaire fonctionne.",
    capabilities: "Fait une chose\nEn fait une autre",
    protocol: "CLI",
    standalone: "yes",
    usage: "python agent.py",
    tagIds: [],
    newThemes: [],
    newTechnologies: [],
    sourceUrl: "",
  };
  it("valide un agent téléchargeable autonome", () => {
    expect(agentSchema.safeParse({ ...base, kind: "DOWNLOAD", version: "1.0.0" }).success).toBe(true);
  });
  it("exige la liste des dépendances quand l'agent n'est pas autonome", () => {
    const r = agentSchema.safeParse({ ...base, kind: "DOWNLOAD", version: "1.0.0", standalone: "no" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toMatch(/dépendances/);
    expect(agentSchema.safeParse({ ...base, kind: "DOWNLOAD", version: "1.0.0", standalone: "no", dependencies: "Ollama" }).success).toBe(true);
  });
  it("refuse une version invalide et un mode d'appel inconnu", () => {
    expect(agentSchema.safeParse({ ...base, kind: "DOWNLOAD", version: "../x" }).success).toBe(false);
    expect(agentSchema.safeParse({ ...base, kind: "DOWNLOAD", version: "1.0.0", protocol: "TELEPATHIE" }).success).toBe(false);
  });
  it("convertit le prix d'un agent à louer", () => {
    const r = agentSchema.safeParse({ ...base, kind: "RENTAL", endpointUrl: "", priceEuros: "4,50", priceUnit: "" });
    expect(r.success && r.data.kind === "RENTAL" && r.data.priceEuros).toBe(4.5);
  });
  it("refuse une URL non http", () => {
    const r = agentSchema.safeParse({ ...base, kind: "RENTAL", endpointUrl: "javascript:alert(1)", priceEuros: "" });
    expect(r.success).toBe(false);
  });
});

describe("manifeste agent.json", () => {
  it("valide les trois exemples du dépôt", () => {
    for (const m of [resumeur, questions, mesh]) expect(manifestSchema.safeParse(m).success).toBe(true);
  });
  it("aplatit un manifeste vers la fiche", () => {
    const fields = manifestToAgentFields(manifestSchema.parse(resumeur));
    expect(fields.kind).toBe("DOWNLOAD");
    expect(fields.protocol).toBe("CLI");
    expect(fields.standalone).toBe(false);
    expect(fields.dependencies.split("\n")).toHaveLength(3);
    expect(fields.tools).toContain("lecture de fichier : ");
    expect(fields.llmModel).toContain("Alternatives : ");
    const rental = manifestToAgentFields(manifestSchema.parse(mesh));
    expect(rental.kind).toBe("RENTAL");
    expect(rental.priceCents).toBe(500);
    expect(rental.priceUnit).toBe("par mesh");
  });
  it("refuse un manifeste sans compétences", () => {
    expect(manifestSchema.safeParse({ ...resumeur, capabilities: [] }).success).toBe(false);
  });
});

describe("storage", () => {
  it("enregistre, relit et refuse les clés hors format", async () => {
    process.env.STORAGE_DIR = await mkdtemp(path.join(tmpdir(), "am-"));
    const { saveFile, deleteFile } = await import("@/lib/storage");
    const saved = await saveFile(new TextEncoder().encode("hello"));
    expect(saved.size).toBe(5);
    expect(saved.sha256).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    expect(await readFile(path.join(process.env.STORAGE_DIR, saved.key), "utf8")).toBe("hello");
    await expect(deleteFile("../../etc/passwd")).rejects.toThrow();
  });
});
