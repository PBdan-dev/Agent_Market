import type { Metadata } from "next";
import { Catalog } from "@/components/Catalog";

export const metadata: Metadata = { title: "Agents à louer" };

export default async function RentalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Catalog
      kind="RENTAL"
      title="Agents à louer"
      intro="Des agents hébergés par leurs créateurs, avec leur propre infrastructure et leurs modèles."
      searchParams={await searchParams}
    />
  );
}
