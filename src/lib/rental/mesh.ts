// Générateur de la démonstration « Mesh 3D sur Blender » : une forme simple, fermée (manifold),
// choisie d'après les mots de la description, sous le nombre maximal de triangles demandé.
// Il remplace le serveur du créateur le temps des tests de location ; le résultat est déterministe,
// donc le fichier est recalculé à chaque téléchargement au lieu d'être stocké.

export type MeshRequest = { description: string; triangles_max?: number; style?: string };
export type Mesh = { shape: string; label: string; recognized: boolean; vertices: [number, number, number][]; faces: [number, number, number][] };

type Profile = { label: string; points: (n: number) => [number, number][]; sharp?: boolean; sides?: number; height: number };

const smooth = (t: number) => t * t * (3 - 2 * t);

// Interpolation douce entre points de contrôle (rayon en fonction de la hauteur relative).
function curve(control: [number, number][]) {
  return (t: number) => {
    for (let i = 1; i < control.length; i++) {
      const [t1, r1] = control[i];
      const [t0, r0] = control[i - 1];
      if (t <= t1) return r0 + (r1 - r0) * smooth((t - t0) / (t1 - t0 || 1));
    }
    return control[control.length - 1][1];
  };
}

function sampled(control: [number, number][]) {
  const r = curve(control);
  return (n: number) => Array.from({ length: n }, (_, i): [number, number] => [r(i / (n - 1)), i / (n - 1)]);
}

const PROFILES: Record<string, Profile> = {
  vase: { label: "vase", height: 1.2, points: sampled([[0, 0.28], [0.35, 0.5], [0.78, 0.17], [0.9, 0.17], [1, 0.26]]) },
  bouteille: { label: "bouteille", height: 1.5, points: sampled([[0, 0.3], [0.55, 0.3], [0.75, 0.11], [0.92, 0.1], [1, 0.12]]) },
  bol: { label: "bol", height: 0.45, points: sampled([[0, 0.25], [0.6, 0.55], [1, 0.62]]) },
  tasse: { label: "tasse", height: 0.6, points: sampled([[0, 0.3], [0.15, 0.33], [1, 0.38]]) },
  sphere: {
    label: "sphère",
    height: 1,
    points: (n) => Array.from({ length: n }, (_, i): [number, number] => {
      const a = (Math.PI * (i + 1)) / (n + 1);
      return [0.5 * Math.sin(a), 0.5 - 0.5 * Math.cos(a)];
    }),
  },
  cylindre: { label: "cylindre", height: 1, sharp: true, points: () => [[0.35, 0], [0.35, 1]] },
  cube: { label: "cube", height: 1, sharp: true, sides: 4, points: () => [[Math.SQRT1_2, 0], [Math.SQRT1_2, 1]] },
  cone: { label: "cône", height: 1, sharp: true, points: () => [[0.45, 0]] },
  pyramide: { label: "pyramide", height: 0.8, sharp: true, sides: 4, points: () => [[0.6, 0]] },
};

const KEYWORDS: [string, string[]][] = [
  ["tore", ["tore", "donut", "beignet", "anneau", "bague", "pneu", "bouee", "torus", "ring"]],
  ["bouteille", ["bouteille", "carafe", "flacon", "bottle"]],
  ["tasse", ["tasse", "mug", "verre", "gobelet", "cup", "canette"]],
  ["bol", ["bol", "saladier", "coupe", "bowl"]],
  ["sphere", ["sphere", "boule", "balle", "ballon", "planete", "globe", "bille", "ball"]],
  ["cube", ["cube", "boite", "caisse", "brique", "de a jouer", "box", "crate"]],
  ["cylindre", ["cylindre", "tube", "colonne", "pilier", "tronc", "cylinder", "pillar"]],
  ["pyramide", ["pyramide", "pyramid"]],
  ["cone", ["cone", "sapin", "entonnoir", "chapeau pointu", "tipi"]],
  ["vase", ["vase", "pot", "urne", "amphore", "lampe", "theiere"]],
];

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function pickShape(description: string): { shape: string; recognized: boolean } {
  const words = ` ${normalize(description).replace(/[^a-z0-9]+/g, " ")} `;
  for (const [shape, keys] of KEYWORDS) {
    if (keys.some((k) => words.includes(` ${k} `) || words.includes(` ${k}s `) || words.includes(` ${k}x `))) return { shape, recognized: true };
  }
  return { shape: "vase", recognized: false };
}

// Surface de révolution fermée : pôle bas, anneaux du profil, pôle haut.
function lathe(profile: Profile, segments: number, rings: number): Pick<Mesh, "vertices" | "faces"> {
  const sides = profile.sides ?? segments;
  const ring = profile.points(rings);
  const vertices: [number, number, number][] = [[0, 0, 0]];
  const offset = profile.sides === 4 ? Math.PI / 4 : 0;
  for (const [r, t] of ring) {
    for (let s = 0; s < sides; s++) {
      const a = offset + (2 * Math.PI * s) / sides;
      vertices.push([r * Math.cos(a), t * profile.height, r * Math.sin(a)]);
    }
  }
  const top = vertices.length;
  vertices.push([0, profile.height, 0]);

  const at = (k: number, s: number) => 1 + k * sides + (s % sides);
  const faces: [number, number, number][] = [];
  for (let s = 0; s < sides; s++) faces.push([0, at(0, s), at(0, s + 1)]);
  for (let k = 0; k < ring.length - 1; k++) {
    for (let s = 0; s < sides; s++) {
      faces.push([at(k, s), at(k + 1, s), at(k + 1, s + 1)], [at(k, s), at(k + 1, s + 1), at(k, s + 1)]);
    }
  }
  const last = ring.length - 1;
  for (let s = 0; s < sides; s++) faces.push([top, at(last, s + 1), at(last, s)]);
  return { vertices, faces };
}

function torus(major: number, minor: number): Pick<Mesh, "vertices" | "faces"> {
  const R = 0.4;
  const r = 0.15;
  const vertices: [number, number, number][] = [];
  for (let i = 0; i < major; i++) {
    const u = (2 * Math.PI * i) / major;
    for (let j = 0; j < minor; j++) {
      const v = (2 * Math.PI * j) / minor;
      vertices.push([(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v) + r, (R + r * Math.cos(v)) * Math.sin(u)]);
    }
  }
  const at = (i: number, j: number) => (i % major) * minor + (j % minor);
  const faces: [number, number, number][] = [];
  for (let i = 0; i < major; i++) {
    for (let j = 0; j < minor; j++) {
      faces.push([at(i, j), at(i, j + 1), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i + 1, j)]);
    }
  }
  return { vertices, faces };
}

export function generateMesh(req: MeshRequest): Mesh {
  const { shape, recognized } = pickShape(req.description);
  const budget = Math.max(500, Math.min(50000, Math.floor(req.triangles_max ?? 5000)));
  const lowPoly = req.style !== "lisse";

  if (shape === "tore") {
    let major = lowPoly ? 12 : 64;
    let minor = lowPoly ? 6 : 32;
    while (2 * major * minor > budget) {
      major = Math.max(3, Math.floor(major * 0.9));
      minor = Math.max(3, Math.floor(minor * 0.9));
    }
    return { shape, label: "anneau", recognized, ...torus(major, minor) };
  }

  const profile = PROFILES[shape];
  // Triangles d'une révolution : 2 × côtés × anneaux.
  let segments = profile.sides ?? (lowPoly ? 10 : 64);
  let rings = profile.sharp ? profile.points(2).length : lowPoly ? 6 : 48;
  while (2 * (profile.sides ?? segments) * rings > budget) {
    if (!profile.sides) segments = Math.max(6, Math.floor(segments * 0.9));
    if (!profile.sharp) rings = Math.max(3, Math.floor(rings * 0.9));
    if ((profile.sides || segments === 6) && (profile.sharp || rings === 3)) break;
  }
  return { shape, label: profile.label, recognized, ...lathe(profile, segments, rings) };
}

export function toObj(mesh: Mesh, title: string): string {
  const lines = [
    "# Mesh 3D sur Blender, démonstration Agent Market",
    `# Demande : ${title.replace(/\s+/g, " ").slice(0, 200)}`,
    `# Forme : ${mesh.label}, ${mesh.faces.length} triangles`,
    `o ${mesh.shape}`,
    ...mesh.vertices.map(([x, y, z]) => `v ${x.toFixed(5)} ${y.toFixed(5)} ${z.toFixed(5)}`),
    ...mesh.faces.map(([a, b, c]) => `f ${a + 1} ${b + 1} ${c + 1}`),
  ];
  return lines.join("\n") + "\n";
}
