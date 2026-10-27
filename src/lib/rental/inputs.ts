import type { InputSchema } from "../manifest";

// Vérifie les entrées d'une tâche contre le contrat déclaré par l'agent (sous-ensemble de JSON Schema)
// et complète les valeurs par défaut. Les nombres et booléens envoyés en texte sont acceptés.
export type InputCheck = { ok: true; value: Record<string, string | number | boolean> } | { ok: false; errors: string[] };

export function checkInputs(schema: InputSchema, raw: unknown): InputCheck {
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return { ok: false, errors: ["Les entrées doivent être un objet JSON."] };
    }
  }
  if (data === undefined || data === null) data = {};
  if (typeof data !== "object" || Array.isArray(data)) return { ok: false, errors: ["Les entrées doivent être un objet JSON."] };

  const input = data as Record<string, unknown>;
  const errors: string[] = [];
  const value: Record<string, string | number | boolean> = {};

  for (const key of Object.keys(input)) {
    if (!(key in schema.properties)) errors.push(`Champ inconnu : « ${key} ». Champs acceptés : ${Object.keys(schema.properties).join(", ")}.`);
  }

  for (const [key, prop] of Object.entries(schema.properties)) {
    let v = input[key];
    if (v === undefined || v === null || v === "") {
      if (prop.default !== undefined) value[key] = prop.default;
      else if (schema.required?.includes(key)) errors.push(`Champ obligatoire manquant : « ${key} »${prop.description ? ` (${prop.description})` : ""}.`);
      continue;
    }
    if ((prop.type === "integer" || prop.type === "number") && typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) v = Number(v);
    if (prop.type === "boolean" && (v === "true" || v === "false")) v = v === "true";

    if (prop.type === "string" && typeof v !== "string") errors.push(`« ${key} » doit être du texte.`);
    else if (prop.type === "integer" && !Number.isInteger(v)) errors.push(`« ${key} » doit être un nombre entier.`);
    else if (prop.type === "number" && (typeof v !== "number" || !Number.isFinite(v))) errors.push(`« ${key} » doit être un nombre.`);
    else if (prop.type === "boolean" && typeof v !== "boolean") errors.push(`« ${key} » doit valoir true ou false.`);
    else {
      const typed = v as string | number | boolean;
      if (prop.enum && !prop.enum.includes(typed as string | number)) errors.push(`« ${key} » doit valoir ${prop.enum.map((e) => `« ${e} »`).join(" ou ")}.`);
      else if (typeof typed === "number" && prop.minimum !== undefined && typed < prop.minimum) errors.push(`« ${key} » doit être au moins ${prop.minimum}.`);
      else if (typeof typed === "number" && prop.maximum !== undefined && typed > prop.maximum) errors.push(`« ${key} » doit être au plus ${prop.maximum}.`);
      else if (typeof typed === "string" && typed.length > (prop.maxLength ?? 10000)) errors.push(`« ${key} » : ${prop.maxLength ?? 10000} caractères au maximum.`);
      else value[key] = typed;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
