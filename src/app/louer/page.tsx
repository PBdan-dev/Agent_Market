import type { Metadata } from "next";
import { Catalog } from "@/components/Catalog";

export const metadata: Metadata = { title: "Agents à louer" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RentalsPage({ searchParams }: Props) {
  return (
    <Catalog
      kind="RENTAL"
      title="Agents à louer"
      intro="Des agents hébergés par leurs créateurs, avec leur propre infrastructure : vous envoyez une demande, vous recevez le résultat."
      searchParams={await searchParams}
    />
  );
}
