import Link from "next/link";
import { KIND_PATHS, type CatalogKind, type TagGroup } from "@/lib/constants";
import { FILTER_PARAMS } from "@/lib/queries";

const STYLES: Record<TagGroup, string> = {
  CATEGORY: "border-mint/40 bg-mint/10 text-mint",
  THEME: "border-violet/40 bg-violet/10 text-[#b8aeff]",
  TECHNOLOGY: "border-cyan/40 bg-cyan/10 text-[#8fd6fb]",
};

const ORDER: Record<string, number> = { CATEGORY: 0, THEME: 1, TECHNOLOGY: 2 };

export function TagBadge({ tag, kind = "ALL" }: { tag: { slug: string; name: string; group: string }; kind?: CatalogKind }) {
  const group = tag.group as TagGroup;
  return (
    <Link
      href={`${KIND_PATHS[kind]}?${FILTER_PARAMS[group]}=${tag.slug}`}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition hover:brightness-125 ${STYLES[group]}`}
    >
      {tag.name}
    </Link>
  );
}

export function sortTags<T extends { tag: { group: string; name: string } }>(tags: T[]): T[] {
  return [...tags].sort((a, b) => ORDER[a.tag.group] - ORDER[b.tag.group] || a.tag.name.localeCompare(b.tag.name));
}
