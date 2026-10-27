// Lecture, dans le navigateur, du agent.json contenu dans l'archive choisie : sert à préremplir
// le formulaire de publication avant l'envoi. Aucune dépendance : DecompressionStream du navigateur.

const MAX_MANIFEST_BYTES = 512 * 1024;
const MANIFEST_RE = /^(?:\.\/)?(?:[^/]+\/)?agent\.json$/;

async function decompress(data: Uint8Array, format: "deflate-raw" | "gzip"): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Préfère agent.json à la racine, sinon celui de l'unique dossier de premier niveau.
const rank = (name: string) => (name.replace(/^\.\//, "") === "agent.json" ? 0 : 1);

async function fromZip(buf: Uint8Array): Promise<Uint8Array | null> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const found: { name: string; method: number; size: number; offset: number }[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < count && p + 46 <= buf.length; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const nameLen = view.getUint16(p + 28, true);
    const name = decoder.decode(buf.subarray(p + 46, p + 46 + nameLen));
    if (MANIFEST_RE.test(name)) {
      found.push({ name, method: view.getUint16(p + 10, true), size: view.getUint32(p + 20, true), offset: view.getUint32(p + 42, true) });
    }
    p += 46 + nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  }
  const entry = found.sort((a, b) => rank(a.name) - rank(b.name))[0];
  if (!entry || entry.size > MAX_MANIFEST_BYTES) return null;
  const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
  const raw = buf.subarray(start, start + entry.size);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return decompress(raw, "deflate-raw");
  return null;
}

function fromTar(tar: Uint8Array): Uint8Array | null {
  const decoder = new TextDecoder();
  const field = (start: number, len: number, at: number) => decoder.decode(tar.subarray(at + start, at + start + len)).replace(/\0.*$/s, "");
  const found: { name: string; data: Uint8Array }[] = [];
  let longName: string | undefined;
  for (let p = 0; p + 512 <= tar.length; ) {
    if (tar.subarray(p, p + 512).every((b) => b === 0)) break;
    const size = parseInt(field(124, 12, p).trim() || "0", 8);
    const type = String.fromCharCode(tar[p + 156]);
    const body = p + 512;
    if (type === "L") longName = decoder.decode(tar.subarray(body, body + size)).replace(/\0+$/, "");
    else {
      const prefix = field(345, 155, p);
      const name = longName ?? (prefix ? `${prefix}/${field(0, 100, p)}` : field(0, 100, p));
      longName = undefined;
      if ((type === "0" || type === "\0") && MANIFEST_RE.test(name) && size <= MAX_MANIFEST_BYTES) found.push({ name, data: tar.subarray(body, body + size) });
    }
    p = body + Math.ceil(size / 512) * 512;
  }
  return found.sort((a, b) => rank(a.name) - rank(b.name))[0]?.data ?? null;
}

// Renvoie le contenu JSON de agent.json, null s'il n'y en a pas. Lève une erreur si le fichier est illisible.
export async function readManifestFromArchive(file: File): Promise<unknown | null> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  const isGzip = buf[0] === 0x1f && buf[1] === 0x8b;
  let raw: Uint8Array | null = null;
  if (isZip) raw = await fromZip(buf);
  else if (isGzip) raw = fromTar(await decompress(buf, "gzip"));
  if (!raw) return null;
  return JSON.parse(new TextDecoder().decode(raw));
}
