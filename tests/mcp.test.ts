import { gzipSync } from "node:zlib";
import { VERSIONED_MANIFEST_SCHEMAS } from "@anthropic-ai/mcpb";
import { describe, expect, it } from "vitest";
import { extractArchive, stripCommonRoot } from "@/lib/archive";
import { DEFAULT_INPUT_SCHEMA, manifestSchema, type AgentManifest } from "@/lib/manifest";
import { BundleError, buildMcpb, MCPB_MANIFEST_VERSION, toMcpbManifest } from "@/lib/mcpb";
import { handleRpcBody, handleRpcMessage } from "@/lib/mcp/server";
import { checkInputs } from "@/lib/rental/inputs";
import { generateMesh, pickShape, toObj } from "@/lib/rental/mesh";
import { buildZip } from "@/lib/zip-build";
import resumeur from "../examples/resumeur-documents/agent.json";
import questions from "../examples/questions-dossier/agent.json";
import mesh from "../examples/mesh-blender/agent.json";

type Installable = AgentManifest & { runtime: NonNullable<AgentManifest["runtime"]> };
const ctx = { slug: "questions-sur-un-dossier", authorName: "Agent Market", pageUrl: "https://exemple.fr/agents/questions-sur-un-dossier" };

function tar(files: Record<string, string>, type = "0"): Buffer {
  const blocks: Buffer[] = [];
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100);
    header.write("0000644\0", 100);
    header.write(data.length.toString(8).padStart(11, "0") + "\0", 124);
    header.write(type, 156);
    header.write("ustar\0", 257);
    blocks.push(header, data, Buffer.alloc(Math.ceil(data.length / 512) * 512 - data.length));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

const text = (f: { data: Uint8Array }) => new TextDecoder().decode(f.data);

describe("extraction d'archive", () => {
  it("relit un zip compressé et ignore les chemins dangereux", () => {
    const big = "x".repeat(5000);
    const zip = buildZip({ "a/agent.json": "{}", "a/server/index.mjs": big, "../evil.sh": "rm -rf /", "/abs.txt": "x", "a/__MACOSX/._x": "" });
    const files = extractArchive(zip, ".zip");
    expect(files.map((f) => f.name)).toEqual(["a/agent.json", "a/server/index.mjs"]);
    expect(text(files[1])).toBe(big);
    expect(zip.byteLength).toBeLessThan(1000); // compressé
    expect(stripCommonRoot(files).map((f) => f.name)).toEqual(["agent.json", "server/index.mjs"]);
  });
  it("relit un tar.gz et ignore les liens symboliques", () => {
    const tgz = gzipSync(Buffer.concat([tar({ "agent.json": "{}", "src/main.py": "print(1)" }).subarray(0, -1024), tar({ "lien": "/etc/passwd" }, "2")]));
    const files = extractArchive(new Uint8Array(tgz), ".tgz");
    expect(files.map((f) => f.name)).toEqual(["agent.json", "src/main.py"]);
    expect(stripCommonRoot(files)).toEqual(files); // pas de dossier commun
  });
});

describe("paquet Claude Desktop (MCPB)", () => {
  for (const example of [questions, resumeur]) {
    it(`produit un manifest.json conforme au schéma officiel (${example.name})`, () => {
      const m = manifestSchema.parse(example) as Installable;
      const mcpb = toMcpbManifest(m, ctx);
      const check = VERSIONED_MANIFEST_SCHEMAS[MCPB_MANIFEST_VERSION].safeParse(mcpb);
      expect(check.success, JSON.stringify(!check.success && check.error.issues)).toBe(true);
      expect(mcpb.server.mcp_config.args).toEqual(["${__dirname}/server/index.mjs"]);
      for (const p of m.parameters ?? []) expect(mcpb.server.mcp_config.env[`AGENT_${p.key.toUpperCase()}`]).toBe(`\${user_config.${p.key}}`);
    });
  }
  it("donne une valeur vide aux réglages facultatifs et marque les secrets", () => {
    const mcpb = toMcpbManifest(manifestSchema.parse(resumeur) as Installable, ctx);
    expect(mcpb.user_config?.serveur_modele).toMatchObject({ default: "", required: false });
    expect(mcpb.user_config?.cle_api).toMatchObject({ sensitive: true });
  });
  it("lance Python avec la bonne commande sous Windows", () => {
    const m = { ...manifestSchema.parse(questions), runtime: { language: "python" as const, entrypoint: "server/main.py" } };
    const mcpb = toMcpbManifest(m, ctx);
    expect(mcpb.server.mcp_config).toMatchObject({ command: "python3", platform_overrides: { win32: { command: "python" } } });
    expect(VERSIONED_MANIFEST_SCHEMAS[MCPB_MANIFEST_VERSION].safeParse(mcpb).success).toBe(true);
  });
  it("assemble le paquet et refuse un point d'entrée absent", () => {
    const m = manifestSchema.parse(questions) as Installable;
    const files = [
      { name: "questions-dossier/server/index.mjs", data: new TextEncoder().encode("// serveur") },
      { name: "questions-dossier/manifest.json", data: new TextEncoder().encode("{\"piege\":true}") },
    ];
    const bundle = extractArchive(buildMcpb(files, m, ctx), ".zip");
    expect(bundle.map((f) => f.name).sort()).toEqual(["agent.json", "manifest.json", "server/index.mjs"]);
    expect(JSON.parse(text(bundle.find((f) => f.name === "manifest.json")!)).name).toBe(ctx.slug);
    expect(() => buildMcpb([{ name: "README.md", data: new Uint8Array() }], m, ctx)).toThrow(BundleError);
  });
});

describe("contrat de location", () => {
  const schema = manifestSchema.parse(mesh).rental!.input!;
  it("applique les valeurs par défaut et convertit les nombres écrits en texte", () => {
    expect(checkInputs(schema, { description: "un vase", triangles_max: "3000" })).toEqual({
      ok: true,
      value: { description: "un vase", triangles_max: 3000, style: "low-poly", format: "obj" },
    });
  });
  it("explique chaque erreur", () => {
    const r = checkInputs(schema, { triangles_max: 10, style: "baroque", couleur: "rouge" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.join("\n")).toMatch(/Champ inconnu : « couleur »[\s\S]*manquant : « description »[\s\S]*au moins 500[\s\S]*« low-poly » ou « lisse »/);
    expect(checkInputs(schema, "[1]").ok).toBe(false);
    expect(checkInputs(DEFAULT_INPUT_SCHEMA, '{"consigne":"Bonjour"}')).toEqual({ ok: true, value: { consigne: "Bonjour" } });
  });
});

describe("démonstration Mesh 3D", () => {
  it("choisit la forme d'après la description", () => {
    expect(pickShape("Une jolie BOUTEILLE de vin")).toEqual({ shape: "bouteille", recognized: true });
    expect(pickShape("des bols empilés").shape).toBe("bol");
    expect(pickShape("une chaise").recognized).toBe(false);
  });
  it("produit des meshes fermés, orientés vers l'extérieur et sous la limite de triangles", () => {
    for (const description of ["vase", "bouteille", "bol", "tasse", "sphère", "cube", "colonne", "cône", "pyramide", "donut", "chaise"]) {
      for (const style of ["low-poly", "lisse"]) {
        for (const max of [500, 5000, 50000]) {
          const m = generateMesh({ description, triangles_max: max, style });
          const edges = new Map<string, number>();
          let volume = 0;
          for (const [a, b, c] of m.faces) {
            for (const [x, y] of [[a, b], [b, c], [c, a]]) edges.set(`${x}>${y}`, (edges.get(`${x}>${y}`) ?? 0) + 1);
            const [p, q, r] = [m.vertices[a], m.vertices[b], m.vertices[c]];
            volume += p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0]);
          }
          for (const [k, n] of edges) {
            const [x, y] = k.split(">");
            expect(n === 1 && edges.get(`${y}>${x}`) === 1, `${description} ${style} ${max} : arête ${k}`).toBe(true);
          }
          expect(m.faces.length).toBeLessThanOrEqual(max);
          expect(volume).toBeGreaterThan(0);
        }
      }
    }
    expect(toObj(generateMesh({ description: "cube" }), "cube").split("\n").filter((l) => l.startsWith("f ")).length).toBe(16);
  });
});

describe("serveur MCP (sans base de données)", () => {
  const c = { origin: "https://exemple.fr" };
  it("négocie la version du protocole", async () => {
    const r = (await handleRpcMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, c)) as { result: { protocolVersion: string; capabilities: object } };
    expect(r.result.protocolVersion).toBe("2025-06-18");
    expect(r.result.capabilities).toHaveProperty("tools");
    const old = (await handleRpcMessage({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } }, c)) as { result: { protocolVersion: string } };
    expect(old.result.protocolVersion).toBe("2025-11-25");
  });
  it("liste les quatre outils", async () => {
    const r = (await handleRpcMessage({ jsonrpc: "2.0", id: "a", method: "tools/list" }, c)) as { result: { tools: { name: string }[] } };
    expect(r.result.tools.map((t) => t.name)).toEqual(["lister_agents", "voir_agent", "lancer_tache", "suivre_tache"]);
  });
  it("ne répond pas aux notifications et signale les méthodes inconnues", async () => {
    expect(await handleRpcMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, c)).toBeNull();
    expect(await handleRpcBody([{ jsonrpc: "2.0", method: "notifications/initialized" }], c)).toBeNull();
    expect(await handleRpcMessage({ jsonrpc: "2.0", id: 3, method: "sampling/createMessage" }, c)).toMatchObject({ error: { code: -32601 } });
    expect(await handleRpcMessage("bonjour", c)).toMatchObject({ error: { code: -32600 } });
    expect(await handleRpcMessage({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "inexistant" } }, c)).toMatchObject({ error: { code: -32602 } });
  });
});
