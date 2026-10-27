import { generateMesh, toObj } from "@/lib/rental/mesh";
import { getTask } from "@/lib/rental/tasks";
import { siteOrigin } from "@/lib/site-url";

// Fichier produit par une tâche de location terminée. Pour la démonstration Mesh 3D, le mesh est
// recalculé à partir des entrées (le générateur est déterministe) : rien n'est stocké.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getTask(id, siteOrigin(request.headers));
  if (!task || task.status !== "DONE" || task.agent.endpointUrl !== "demo:mesh-blender") {
    return new Response("Fichier introuvable, ou tâche pas encore terminée.", { status: 404 });
  }
  const input = JSON.parse(task.input) as { description: string; triangles_max?: number; style?: string };
  const mesh = generateMesh(input);
  return new Response(toObj(mesh, input.description), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${mesh.shape}-${task.id.slice(2, 10)}.obj"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
