import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { detectArchiveExtension, downloadFilename, findManifest, listArchiveEntries } from "@/lib/archive";
import { isOneClickInstallable, manifestSchema, manifestToAgentFields, publicManifest } from "@/lib/manifest";
import { manifestToFormValues } from "@/lib/manifest-form";
import { slugify } from "@/lib/slug";
import { agentSchema, formToManifest, parseTagList } from "@/lib/validation";
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
    modelUses: "host",
    protocol: "CLI",
    standalone: "yes",
    os: [],
    tagIds: [],
    newThemes: [],
    newTechnologies: [],
    sourceUrl: "",
  };
  const download = { ...base, kind: "DOWNLOAD", version: "1.0.0", permFiles: "read", permNetwork: "none" };
  it("valide un agent téléchargeable autonome", () => {
    expect(agentSchema.safeParse(download).success).toBe(true);
  });
  it("exige la liste des dépendances quand l'agent n'est pas autonome", () => {
    const r = agentSchema.safeParse({ ...download, standalone: "no" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toMatch(/dépendances/);
    expect(agentSchema.safeParse({ ...download, standalone: "no", dependencies: "Ollama" }).success).toBe(true);
  });
  it("exige langage et point d'entrée pour un serveur MCP téléchargeable", () => {
    const r = agentSchema.safeParse({ ...download, protocol: "MCP" });
    expect(!r.success && r.error.issues[0].message).toMatch(/point d'entrée/);
    expect(agentSchema.safeParse({ ...download, protocol: "MCP", runtimeLanguage: "node", entrypoint: "server/index.mjs" }).success).toBe(true);
  });
  it("refuse une version invalide et un mode d'appel inconnu", () => {
    expect(agentSchema.safeParse({ ...download, version: "../x" }).success).toBe(false);
    expect(agentSchema.safeParse({ ...download, version: "v2" }).success).toBe(false);
    expect(agentSchema.safeParse({ ...download, protocol: "TELEPATHIE" }).success).toBe(false);
  });
  it("convertit le prix d'un agent à louer et lit son contrat", () => {
    const r = agentSchema.safeParse({ ...base, kind: "RENTAL", endpointUrl: "", priceEuros: "4,50", priceUnit: "", inputSchema: "" });
    expect(r.success && r.data.kind === "RENTAL" && r.data.priceEuros).toBe(4.5);
    const bad = agentSchema.safeParse({ ...base, kind: "RENTAL", endpointUrl: "", priceEuros: "", inputSchema: "{pas du json" });
    expect(!bad.success && bad.error.issues[0].message).toMatch(/JSON invalide/);
  });
  it("refuse une URL non http", () => {
    const r = agentSchema.safeParse({ ...base, kind: "RENTAL", endpointUrl: "javascript:alert(1)", priceEuros: "" });
    expect(r.success).toBe(false);
  });
  it("produit un manifeste v2 valide à partir du formulaire", () => {
    const parsed = agentSchema.parse({
      ...download,
      protocol: "MCP",
      runtimeLanguage: "node",
      entrypoint: "server/index.mjs",
      tools: "chercher : cherche un mot\nlire",
      parameters: JSON.stringify([{ key: "dossier", type: "directory", label: "Dossier", required: true }]),
      ramGb: "0,5",
      os: ["win32"],
    });
    const m = formToManifest(parsed, { category: ["Recherche"], theme: [], technology: ["MCP"] });
    expect(m.runtime).toEqual({ language: "node", entrypoint: "server/index.mjs" });
    expect(m.tools).toEqual([{ name: "chercher", description: "cherche un mot" }, { name: "lire" }]);
    expect(m.parameters?.[0].key).toBe("dossier");
    expect(m.requirements).toEqual({ ramGb: 0.5, os: ["win32"] });
    expect(isOneClickInstallable(m)).toBe(true);
  });
});

describe("manifeste agent.json", () => {
  it("valide les trois exemples du dépôt", () => {
    for (const m of [resumeur, questions, mesh]) {
      const r = manifestSchema.safeParse(m);
      expect(r.success, JSON.stringify(!r.success && r.error.issues)).toBe(true);
    }
  });
  it("aplatit un manifeste vers la fiche", () => {
    const fields = manifestToAgentFields(manifestSchema.parse(resumeur));
    expect(fields.kind).toBe("DOWNLOAD");
    expect(fields.protocol).toBe("MCP");
    expect(fields.standalone).toBe(true);
    expect(fields.tools).toContain("resumer_document : ");
    expect(fields.llmModel).toContain("Recommandés : llama3.2");
    expect(fields.requirements).toContain("RAM : 102 Mo");
    expect(JSON.parse(fields.manifest).schema).toBe("agent-market/v2");
    const rental = manifestToAgentFields(manifestSchema.parse(mesh));
    expect(rental.kind).toBe("RENTAL");
    expect(rental.priceCents).toBe(500);
    expect(rental.priceUnit).toBe("par mesh");
    expect(rental.endpointUrl).toBe("demo:mesh-blender");
  });
  it("ne divulgue pas l'adresse privée d'un loueur", () => {
    expect(publicManifest(manifestSchema.parse(mesh)).rental).not.toHaveProperty("endpoint");
  });
  it("refuse un manifeste sans compétences, ou un serveur MCP sans point d'entrée", () => {
    expect(manifestSchema.safeParse({ ...resumeur, capabilities: [] }).success).toBe(false);
    expect(manifestSchema.safeParse({ ...resumeur, runtime: undefined }).success).toBe(false);
    expect(manifestSchema.safeParse({ ...resumeur, runtime: { language: "node", entrypoint: "../evil.js" } }).success).toBe(false);
  });
  it("préremplit le formulaire à partir d'un agent.json", () => {
    const p = manifestToFormValues(questions);
    expect(p.fields).toMatchObject({ name: "Questions sur un dossier", protocol: "MCP", runtimeLanguage: "node", entrypoint: "server/index.mjs", standalone: "yes", permFiles: "read" });
    expect(p.parameters?.[0]).toMatchObject({ key: "dossier", type: "directory", required: true });
    expect(p.tags.technology).toEqual(["MCP", "Node.js"]);
    expect(manifestToFormValues("n'importe quoi").fields).toEqual({});
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
