import { gunzipSync, inflateRawSync } from "node:zlib";
import { ALLOWED_ARCHIVE_EXTENSIONS } from "./constants";

// Vérifie l'extension ET la signature binaire : une archive renommée n'est pas acceptée.
export function detectArchiveExtension(filename: string, head: Uint8Array): string | null {
  const lower = filename.toLowerCase();
  const ext = ALLOWED_ARCHIVE_EXTENSIONS.find((e) => lower.endsWith(e));
  if (!ext) return null;

  const isZip = head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  const isGzip = head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b;

  if (ext === ".zip" && isZip) return ext;
  if ((ext === ".tar.gz" || ext === ".tgz") && isGzip) return ext;
  return null;
}

// Nom de fichier proposé au téléchargement : on ne réutilise jamais le nom envoyé par l'utilisateur.
export function downloadFilename(slug: string, version: string, ext: string): string {
  const safeVersion = version.replace(/[^a-zA-Z0-9.\-]/g, "_");
  return `${slug}-${safeVersion}${ext}`;
}

export const MAX_LISTED_ENTRIES = 500;
const MAX_TAR_BYTES = 256 * 1024 * 1024;

// Liste les fichiers d'une archive (sans les dossiers) sans rien extraire sur disque.
// Lève une erreur si l'archive est illisible.
export function listArchiveEntries(data: Uint8Array, ext: string, limit = MAX_LISTED_ENTRIES): string[] {
  const names = ext === ".zip" ? listZipEntries(data) : listTarEntries(gunzipSync(data, { maxOutputLength: MAX_TAR_BYTES }));
  return names
    .map((n) => n.replace(/^\.\//, ""))
    .filter((n) => n && !n.endsWith("/") && !n.startsWith("__MACOSX/") && !/(^|\/)\.DS_Store$/.test(n))
    .slice(0, limit);
}

// agent.json à la racine, ou dans l'unique dossier de premier niveau.
export function findManifest(entries: string[]): string | undefined {
  return entries.find((e) => e === "agent.json") ?? entries.find((e) => /^[^/]+\/agent\.json$/.test(e));
}

function listZipEntries(data: Uint8Array): string[] {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  // Fin du répertoire central (EOCD) : 22 octets + un commentaire de 65535 octets au plus.
  const minPos = Math.max(0, buf.length - 22 - 65535);
  let eocd = -1;
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Archive zip illisible");
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff) throw new Error("Archive zip64 non prise en charge");

  const names: string[] = [];
  let p = cdOffset;
  for (let i = 0; i < count && p + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    names.push(buf.subarray(p + 46, p + 46 + nameLen).toString("utf8"));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

function listTarEntries(tar: Buffer): string[] {
  const field = (block: Buffer, start: number, len: number) =>
    block.subarray(start, start + len).toString("utf8").replace(/\0.*$/s, "");
  const names: string[] = [];
  let longName: string | undefined;
  let p = 0;
  while (p + 512 <= tar.length) {
    const header = tar.subarray(p, p + 512);
    if (header.every((b) => b === 0)) break;
    const size = parseInt(field(header, 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(header[156]);
    const body = p + 512;
    const next = body + Math.ceil(size / 512) * 512;
    if (type === "L") {
      // Nom long GNU : le bloc suivant contient le nom complet.
      longName = tar.subarray(body, body + size).toString("utf8").replace(/\0+$/, "");
    } else {
      const prefix = field(header, 345, 155);
      const name = field(header, 0, 100);
      const full = longName ?? (prefix ? `${prefix}/${name}` : name);
      longName = undefined;
      if (type !== "x" && type !== "g" && type !== "5") names.push(full);
    }
    p = next;
  }
  return names;
}

// ---------------------------------------------------------------------------
// Extraction en mémoire, pour reconstruire un paquet d'installation (.mcpb).

export const MAX_EXTRACTED_BYTES = 256 * 1024 * 1024;
const MAX_EXTRACTED_FILES = 20_000;

export type ArchiveFile = { name: string; data: Uint8Array };

// Chemin sûr : relatif, sans « .. », séparateurs « / ». null pour ce qu'on ignore (dossiers, fichiers système).
function safeEntryName(raw: string): string | null {
  const name = raw.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!name || name.endsWith("/") || name.startsWith("/") || /^[A-Za-z]:/.test(name)) return null;
  const parts = name.split("/");
  if (parts.some((p) => p === ".." || p === "")) return null;
  if (parts.includes("__MACOSX") || parts.at(-1) === ".DS_Store") return null;
  return name;
}

// Fichiers d'une archive .zip, .tar.gz ou .tgz. Les liens symboliques sont ignorés.
export function extractArchive(data: Uint8Array, ext: string): ArchiveFile[] {
  const files = ext === ".zip" ? extractZip(data) : extractTar(gunzipSync(data, { maxOutputLength: MAX_TAR_BYTES }));
  const out: ArchiveFile[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const name = safeEntryName(f.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, data: f.data });
  }
  return out;
}

// Si tout est rangé dans un seul dossier de premier niveau (« mon-agent/… »), on le retire.
export function stripCommonRoot(files: ArchiveFile[]): ArchiveFile[] {
  const roots = new Set(files.map((f) => (f.name.includes("/") ? f.name.split("/")[0] : "")));
  if (roots.size !== 1 || roots.has("")) return files;
  const root = [...roots][0];
  return files.map((f) => ({ name: f.name.slice(root.length + 1), data: f.data }));
}

// Même règle appliquée à une simple liste de chemins.
export function stripCommonRootNames(names: string[]): string[] {
  return stripCommonRoot(names.map((name) => ({ name, data: new Uint8Array() }))).map((f) => f.name);
}

function extractZip(data: Uint8Array): ArchiveFile[] {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const minPos = Math.max(0, buf.length - 22 - 65535);
  let eocd = -1;
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Archive zip illisible");
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff || count === 0xffff) throw new Error("Archive zip64 non prise en charge");
  if (count > MAX_EXTRACTED_FILES) throw new Error("Archive : trop de fichiers");

  const files: ArchiveFile[] = [];
  let total = 0;
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Archive zip illisible");
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const externalAttrs = buf.readUInt32LE(p + 38);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;

    const isSymlink = ((externalAttrs >>> 16) & 0o170000) === 0o120000;
    if (name.endsWith("/") || isSymlink) continue;
    total += size;
    if (total > MAX_EXTRACTED_BYTES) throw new Error("Archive trop volumineuse une fois décompressée");

    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Archive zip illisible");
    const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const raw = buf.subarray(start, start + compressedSize);
    let content: Buffer;
    if (method === 0) content = Buffer.from(raw);
    else if (method === 8) content = inflateRawSync(raw, { maxOutputLength: Math.max(size, 1) });
    else throw new Error(`Méthode de compression zip non prise en charge (${method})`);
    if (content.length !== size) throw new Error("Archive zip corrompue");
    files.push({ name, data: new Uint8Array(content) });
  }
  return files;
}

function extractTar(tar: Buffer): ArchiveFile[] {
  const field = (block: Buffer, start: number, len: number) =>
    block.subarray(start, start + len).toString("utf8").replace(/\0.*$/s, "");
  const files: ArchiveFile[] = [];
  let longName: string | undefined;
  let p = 0;
  while (p + 512 <= tar.length) {
    const header = tar.subarray(p, p + 512);
    if (header.every((b) => b === 0)) break;
    const size = parseInt(field(header, 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(header[156]);
    const body = p + 512;
    if (type === "L") {
      longName = tar.subarray(body, body + size).toString("utf8").replace(/\0+$/, "");
    } else {
      const prefix = field(header, 345, 155);
      const name = longName ?? (prefix ? `${prefix}/${field(header, 0, 100)}` : field(header, 0, 100));
      longName = undefined;
      // Seuls les fichiers ordinaires sont gardés (pas de liens, ni de périphériques).
      if (type === "0" || type === "\0") {
        if (files.length >= MAX_EXTRACTED_FILES) throw new Error("Archive : trop de fichiers");
        files.push({ name, data: new Uint8Array(tar.subarray(body, body + size)) });
      }
    }
    p = body + Math.ceil(size / 512) * 512;
  }
  return files;
}
