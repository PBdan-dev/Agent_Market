import Link from "next/link";
import { KIND_PATHS, type AgentKind, type TagGroup } from "@/lib/constants";

const STYLES: Record<TagGroup, string> = {
  CATEGORY: "bg-slate-900 text-white",
  THEME: "bg-violet-100 text-violet-800",
  TECHNOLOGY: "bg-sky-100 text-sky-800",
};

const PARAMS: Record<TagGroup, string> = { CATEGORY: "categorie", THEME: "theme", TECHNOLOGY: "techno" };

export function TagBadge({ tag, kind }: { tag: { slug: string; name: string; group: string }; kind: AgentKind }) {
  const group = tag.group as TagGroup;
  return (
    <Link
      href={`${KIND_PATHS[kind]}?${PARAMS[group]}=${tag.slug}`}
      className={`rounded-full px-2 py-0.5 text-xs font-medium hover:opacity-80 ${STYLES[group]}`}
    >
      {tag.name}
    </Link>
  );
}

export function sortTags<T extends { tag: { group: string; name: string } }>(tags: T[]): T[] {
  const order = ["CATEGORY", "THEME", "TECHNOLOGY"];
  return [...tags].sort(
    (a, b) => order.indexOf(a.tag.group) - order.indexOf(b.tag.group) || a.tag.name.localeCompare(b.tag.name),
  );
}
