import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

// Stockage des archives sur disque local. Interface volontairement minimale pour pouvoir
// basculer sur un stockage objet (S3, R2...) sans toucher au reste du code.
function root(): string {
  return path.resolve(process.env.STORAGE_DIR ?? "./storage");
}

function resolveKey(key: string): string {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Clé de stockage invalide");
  return path.join(root(), key);
}

export async function saveFile(data: Uint8Array): Promise<{ key: string; sha256: string; size: number }> {
  await mkdir(root(), { recursive: true });
  const key = randomUUID();
  await writeFile(resolveKey(key), data, { flag: "wx" });
  const sha256 = createHash("sha256").update(data).digest("hex");
  return { key, sha256, size: data.byteLength };
}

export async function openFile(key: string): Promise<{ stream: ReadableStream; size: number }> {
  const filePath = resolveKey(key);
  const { size } = await stat(filePath);
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return { stream, size };
}

export async function deleteFile(key: string): Promise<void> {
  await rm(resolveKey(key), { force: true });
}
