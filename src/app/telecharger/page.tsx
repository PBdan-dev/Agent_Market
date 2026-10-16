import type { Metadata } from "next";
import { Catalog } from "@/components/Catalog";

export const metadata: Metadata = { title: "Agents téléchargeables" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DownloadsPage({ searchParams }: Props) {
  return (
    <Catalog
      kind="DOWNLOAD"
      title="Agents téléchargeables"
      intro="Un package complet à décompresser et lancer chez vous : code, prompts, outils et dépendances déclarées."
      searchParams={await searchParams}
    />
  );
}
