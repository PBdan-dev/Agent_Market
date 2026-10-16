import type { AgentKind } from "@/lib/constants";

// Illustration générée pour chaque agent : teinte selon la catégorie, couleur selon le type,
// pictogramme selon la catégorie, orbites animées. Déterministe (même agent, même image).

const KIND_COLOR: Record<AgentKind, string> = { DOWNLOAD: "#3ef0c6", RENTAL: "#ffb454" };

const CATEGORY_HUE: Record<string, number> = {
  productivite: 165,
  communication: 200,
  developpement: 262,
  "3d-creation": 292,
  "image-video": 335,
  "donnees-analyse": 222,
  "marketing-ventes": 24,
  recherche: 188,
  finance: 46,
  autre: 240,
};

// Pictogrammes dans une boîte de 48 × 48.
const GLYPHS: Record<string, React.ReactNode> = {
  productivite: (
    <>
      <circle cx="24" cy="24" r="15" />
      <path d="M16 24.5l5.5 5.5L33 18" />
    </>
  ),
  communication: <path d="M9 12h30v18H23l-9 7v-7H9z M16 21h16" />,
  developpement: <path d="M17 15l-9 9 9 9M31 15l9 9-9 9M28 11l-8 26" />,
  "3d-creation": <path d="M24 7l15 8.5v17L24 41 9 32.5v-17z M24 24l15-8.5 M24 24L9 15.5 M24 24v17" />,
  "image-video": (
    <>
      <rect x="8" y="11" width="32" height="26" rx="4" />
      <path d="M20 18l10 6-10 6z" />
    </>
  ),
  "donnees-analyse": <path d="M11 37V23M21 37V12M31 37V27M41 37V18M7 37h36" />,
  "marketing-ventes": <path d="M9 20v8h6l13 8V12l-13 8z M33 19a7 7 0 010 10 M37 15a12 12 0 010 18" />,
  recherche: (
    <>
      <circle cx="21" cy="21" r="11" />
      <path d="M29 29l10 10" />
    </>
  ),
  finance: (
    <>
      <circle cx="24" cy="24" r="15" />
      <path d="M24 14v20M20 19h6.5a3 3 0 010 6h-5a3 3 0 000 6H30" />
    </>
  ),
  autre: <path d="M24 7l3.5 12.5L40 23l-12.5 3.5L24 39l-3.5-12.5L8 23l12.5-3.5z" />,
};

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function AgentVisual({
  slug,
  kind,
  category,
  className,
}: {
  slug: string;
  kind: AgentKind;
  category?: string;
  className?: string;
}) {
  const seed = hash(slug);
  const hue = category && CATEGORY_HUE[category] !== undefined ? CATEGORY_HUE[category] : seed % 360;
  const color = KIND_COLOR[kind];
  const glyph = GLYPHS[category ?? ""] ?? GLYPHS.autre;
  const id = `v-${slug}`;
  const tilt = -14 + (seed % 20);
  const sparkles = Array.from({ length: 7 }, (_, i) => {
    const s = hash(`${slug}-${i}`);
    return { x: 16 + (s % 288), y: 14 + ((s >>> 8) % 152), r: 1 + ((s >>> 16) % 3) * 0.6, o: 0.25 + ((s >>> 20) % 5) * 0.12 };
  });

  return (
    <svg
      viewBox="0 0 320 180"
      className={className}
      role="img"
      aria-label={`Illustration de l'agent ${slug}`}
      data-animated
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 50% 14%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 40) % 360} 45% 8%)`} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={color} stopOpacity="0.55" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}-dots`} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.08)" />
        </pattern>
      </defs>

      <rect width="320" height="180" fill={`url(#${id}-bg)`} />
      <rect width="320" height="180" fill={`url(#${id}-dots)`} />
      <circle cx="160" cy="90" r="78" fill={`url(#${id}-glow)`} />

      {sparkles.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
      ))}

      {/* Orbites */}
      <g transform={`translate(160 90) rotate(${tilt})`}>
        <ellipse rx="126" ry="48" fill="none" stroke={color} strokeOpacity="0.28" strokeWidth="1" />
        <circle r="4" fill={color}>
          <animateMotion dur="14s" repeatCount="indefinite" path="M126,0 A126,48 0 1,1 -126,0 A126,48 0 1,1 126,0" />
        </circle>
      </g>
      <g transform={`translate(160 90) rotate(${tilt + 62})`}>
        <ellipse rx="86" ry="30" fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="1" />
        <circle r="2.5" fill="#fff" opacity="0.8">
          <animateMotion dur="9s" repeatCount="indefinite" path="M-86,0 A86,30 0 1,0 86,0 A86,30 0 1,0 -86,0" />
        </circle>
      </g>

      {/* Noyau */}
      <circle cx="160" cy="90" r="44" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="1">
        <animate attributeName="r" values="42;54;42" dur="4.5s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.35;0;0.35" dur="4.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="160" cy="90" r="38" fill="rgba(7,11,20,0.55)" stroke={color} strokeOpacity="0.6" strokeWidth="1.2" />
      <g transform="translate(136 66)" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {glyph}
      </g>
    </svg>
  );
}
