import { gunzipSync } from "node:zlib";
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
export function listArchiveEntries(data: Uint8Array, ext: string): string[] {
  const names = ext === ".zip" ? listZipEntries(data) : listTarEntries(gunzipSync(data, { maxOutputLength: MAX_TAR_BYTES }));
  return names
    .map((n) => n.replace(/^\.\//, ""))
    .filter((n) => n && !n.endsWith("/") && !n.startsWith("__MACOSX/") && !/(^|\/)\.DS_Store$/.test(n))
    .slice(0, MAX_LISTED_ENTRIES);
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
