import { downloadFilename } from "@/lib/archive";
import { db } from "@/lib/db";
import { openFile } from "@/lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const version = new URL(request.url).searchParams.get("version");

  const agent = await db.agent.findUnique({
    where: { slug },
    include: {
      files: version ? { where: { version } } : { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const file = agent?.kind === "DOWNLOAD" && agent.status === "PUBLISHED" ? agent.files[0] : undefined;
  if (!agent || !file) return new Response("Introuvable", { status: 404 });

  const { stream, size } = await openFile(file.storageKey);
  await db.agent.update({ where: { id: agent.id }, data: { downloadCount: { increment: 1 } } });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${downloadFilename(agent.slug, file.version, file.extension)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
