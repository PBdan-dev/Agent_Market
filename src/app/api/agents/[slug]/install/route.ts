import { extractArchive } from "@/lib/archive";
import { db } from "@/lib/db";
import { isOneClickInstallable, parseManifest } from "@/lib/manifest";
import { BundleError, buildMcpb } from "@/lib/mcpb";
import { siteOrigin } from "@/lib/site-url";
import { readStoredFile } from "@/lib/storage";

// Paquet d'installation en un clic (.mcpb) : double-cliqué, il ouvre Claude Desktop sur la fenêtre d'installation.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const version = new URL(request.url).searchParams.get("version");

  const agent = await db.agent.findUnique({
    where: { slug },
    include: {
      author: { select: { name: true } },
      files: version ? { where: { version } } : { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const file = agent?.kind === "DOWNLOAD" && agent.status === "PUBLISHED" ? agent.files[0] : undefined;
  if (!agent || !file) return new Response("Introuvable", { status: 404 });

  const manifest = parseManifest(agent.manifest);
  if (!isOneClickInstallable(manifest)) {
    return new Response("Cet agent ne s'installe pas en un clic : téléchargez son archive.", { status: 404 });
  }

  let bundle: Uint8Array;
  try {
    const files = extractArchive(await readStoredFile(file.storageKey), file.extension);
    bundle = buildMcpb(files, { ...manifest, version: file.version.match(/^\d+\.\d+\.\d+/) ? file.version : manifest.version }, {
      slug: agent.slug,
      authorName: agent.author.name,
      pageUrl: `${siteOrigin(request.headers)}/agents/${agent.slug}`,
    });
  } catch (err) {
    const message = err instanceof BundleError ? err.message : "Archive illisible : le paquet d'installation n'a pas pu être construit.";
    return new Response(message, { status: 422 });
  }
  await db.agent.update({ where: { id: agent.id }, data: { downloadCount: { increment: 1 } } });

  const safeVersion = file.version.replace(/[^a-zA-Z0-9.\-]/g, "_");
  return new Response(Buffer.from(bundle), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(bundle.byteLength),
      "Content-Disposition": `attachment; filename="${agent.slug}-${safeVersion}.mcpb"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
