import type { Metadata } from "next";
import { Catalog } from "@/components/Catalog";

export const metadata: Metadata = { title: "Agents téléchargeables" };

export default async function DownloadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Catalog
      kind="DOWNLOAD"
      title="Agents téléchargeables"
      intro="Du code à télécharger et à brancher sur votre orchestrateur, local ou cloud."
      searchParams={await searchParams}
    />
  );
}
