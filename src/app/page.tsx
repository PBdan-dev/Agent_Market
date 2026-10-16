import { Catalog } from "@/components/Catalog";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HomePage({ searchParams }: Props) {
  return (
    <Catalog
      kind="ALL"
      title="Des agents prêts à servir"
      intro="Téléchargez un agent pour l'exécuter chez vous, ou louez un agent hébergé par son créateur. Chaque fiche dit ce que l'agent sait faire, ce qu'il requiert et comment l'appeler."
      searchParams={await searchParams}
    />
  );
}
