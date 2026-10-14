import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { PublishForm } from "./PublishForm";

export const metadata: Metadata = { title: "Publier un agent" };

export default async function PublishPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  if (!(await currentUser())) redirect("/connexion?next=/publier");
  const tags = await db.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, group: true } });
  const { type } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Publier un agent</h1>
      <p className="mt-1 text-slate-600">
        Un agent téléchargeable est une archive de code que les utilisateurs exécutent chez eux. Un agent à louer est un
        service que vous hébergez vous-même.
      </p>
      <PublishForm
        tags={tags}
        maxUploadMb={Number(process.env.MAX_UPLOAD_MB ?? 50)}
        initialKind={type === "location" ? "RENTAL" : "DOWNLOAD"}
      />
    </div>
  );
}
