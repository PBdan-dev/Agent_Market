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
