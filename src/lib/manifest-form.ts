// agent.json (v2, ou l'ancien v1) → valeurs du formulaire de publication. Lecture tolérante :
// un champ absent ou mal typé est simplement ignoré, l'auteur complète à la main.
import type { AgentParameter } from "./manifest";

export type PrefillValues = {
  fields: Record<string, string>;
  tags: { category: string[]; theme: string[]; technology: string[] };
  os?: string[];
  parameters?: AgentParameter[];
  schema: string;
};

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const strings = (v: unknown) => arr(v).filter((x): x is string => typeof x === "string");
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function manifestToFormValues(raw: unknown): PrefillValues {
  const m = obj(raw);
  const fields: Record<string, string> = {};
  const set = (key: string, value: string | undefined) => {
    if (value !== undefined && value !== "") fields[key] = value;
  };

  set("name", str(m.name));
  set("version", str(m.version));
  set("summary", str(m.summary));
  set("objective", str(m.objective));
  set("description", str(m.description));
  set("capabilities", strings(m.capabilities).join("\n"));
  set(
    "tools",
    arr(m.tools)
      .map((t) => {
        const o = obj(t);
        return str(o.name) ? (str(o.description) ? `${o.name} : ${o.description}` : str(o.name)) : undefined;
      })
      .filter(Boolean)
      .join("\n"),
  );

  const model = obj(m.model);
  set("modelUses", ["host", "own", "none"].includes(str(model.uses) ?? "") ? str(model.uses) : undefined);
  set("modelNames", strings(model.recommended).join(", ") || str(model.name));
  if (obj(model.needs).toolCalling === true) fields.modelToolCalling = "on";
  set("modelNote", str(model.note));

  const prompts = obj(m.prompts);
  set("promptSystem", str(prompts.system));
  set("promptTasks", strings(prompts.tasks).join("\n"));
  set("promptNote", str(prompts.note));

  const runtime = obj(m.runtime);
  set("protocol", str(m.protocol) ?? str(runtime.protocol));
  if (["node", "python", "binary", "other"].includes(str(runtime.language) ?? "")) set("runtimeLanguage", str(runtime.language));
  set("runtimeVersion", str(runtime.version));
  set("entrypoint", str(runtime.entrypoint));

  const deps = obj(m.dependencies);
  if (typeof deps.standalone === "boolean") fields.standalone = deps.standalone ? "yes" : "no";
  set("dependencies", strings(deps.requires).join("\n"));

  const req = obj(m.requirements);
  set("ramGb", str(req.ramGb));
  set("vramGb", str(req.vramGb));
  set("requirementsNote", str(req.note));

  const perms = obj(m.permissions);
  set("permFiles", str(perms.files));
  set("permNetwork", str(perms.network));
  set("permAccounts", strings(perms.accounts).join(", "));

  const io = obj(m.io);
  set("inputs", str(io.inputs));
  set("outputs", str(io.outputs));
  set("usage", str(m.usage));
  set("license", str(m.license));
  set("sourceUrl", str(m.source));

  const tags = obj(m.tags);
  const parameters = Array.isArray(m.parameters)
    ? m.parameters
        .map((p) => obj(p))
        .filter((p) => typeof p.key === "string")
        .map(
          (p): AgentParameter => ({
            key: String(p.key),
            type: (["string", "number", "boolean", "directory", "file"].includes(String(p.type)) ? p.type : "string") as AgentParameter["type"],
            label: str(p.label) ?? String(p.key),
            description: str(p.description),
            required: p.required === true,
            secret: p.secret === true,
            default: typeof p.default === "string" || typeof p.default === "number" || typeof p.default === "boolean" ? p.default : undefined,
          }),
        )
    : undefined;

  return {
    fields,
    tags: { category: strings(tags.category), theme: strings(tags.theme), technology: strings(tags.technology) },
    os: Array.isArray(req.os) ? strings(req.os) : undefined,
    parameters,
    schema: str(m.schema) ?? "",
  };
}
