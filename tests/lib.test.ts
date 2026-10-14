import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectArchiveExtension, downloadFilename } from "@/lib/archive";
import { slugify } from "@/lib/slug";
import { agentSchema, parseTagList } from "@/lib/validation";

const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
const GZIP = new Uint8Array([0x1f, 0x8b, 0x08, 0x00]);

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
    description: "Une description suffisamment longue pour passer.",
    tagIds: [],
    newThemes: [],
    newTechnologies: [],
    sourceUrl: "",
  };
  it("valide un agent téléchargeable", () => {
    expect(agentSchema.safeParse({ ...base, kind: "DOWNLOAD", version: "1.0.0" }).success).toBe(true);
  });
  it("refuse une version invalide", () => {
    expect(agentSchema.safeParse({ ...base, kind: "DOWNLOAD", version: "../x" }).success).toBe(false);
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
