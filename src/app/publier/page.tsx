import type { Metadata } from "next";
import Link from "next/link";
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
      <div className="animate-fade-up">
        <p className="mono-label">Publication</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Publier un agent</h1>
        <p className="mt-2 text-muted">
          Remplis la fiche d&apos;identité de ton agent : c&apos;est ce que verront les visiteurs. Les champs marqués * sont obligatoires.{" "}
          <Link href="/format" className="text-mint hover:underline">
            Voir le format du package
          </Link>
          .
        </p>
      </div>
      <PublishForm
        tags={tags}
        maxUploadMb={Number(process.env.MAX_UPLOAD_MB ?? 50)}
        initialKind={type === "location" ? "RENTAL" : "DOWNLOAD"}
      />
    </div>
  );
}
