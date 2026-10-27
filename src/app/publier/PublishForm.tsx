"use client";

import { useActionState, useRef, useState } from "react";
import { createAgent } from "@/app/actions/agents";
import { SubmitButton } from "@/components/SubmitButton";
import { readManifestFromArchive } from "@/lib/archive-browser";
import { PROTOCOLS, PROTOCOL_LABELS, TAG_GROUP_LABELS, type AgentKind, type TagGroup } from "@/lib/constants";
import {
  DEFAULT_INPUT_SCHEMA,
  FILE_ACCESS_LABELS,
  MODEL_USE_LABELS,
  NETWORK_ACCESS_LABELS,
  OUTPUT_TYPE_LABELS,
  PARAMETER_TYPE_LABELS,
  PLATFORM_LABELS,
  RUNTIME_LABELS,
  type AgentParameter,
  type ModelUse,
  type ParameterType,
  type Platform,
} from "@/lib/manifest";
import { manifestToFormValues } from "@/lib/manifest-form";
import { slugify } from "@/lib/slug";

type Tag = { id: string; name: string; group: string };
type Notice = { tone: "ok" | "info" | "error"; text: string };

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="card animate-fade-up space-y-4">
      <legend className="px-1">
        <span className="font-mono text-xs text-mint">{String(n).padStart(2, "0")}</span>
        <span className="ml-2 text-sm font-semibold">{title}</span>
      </legend>
      {hint && <p className="-mt-1 text-xs text-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}

function Field({ id, label, required, hint, children }: { id: string; label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {required && <span className="text-mint"> *</span>}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function Choice<T extends string>({ name, value, current, onChange, children }: { name: string; value: T; current: string; onChange: (v: T) => void; children: React.ReactNode }) {
  return (
    <label
      className={`cursor-pointer rounded-xl border px-3.5 py-2 text-sm transition ${
        current === value ? "border-mint bg-mint/10 text-mint" : "border-line bg-black/20 text-muted hover:border-line-strong"
      }`}
    >
      <input type="radio" name={name} value={value} checked={current === value} onChange={() => onChange(value)} className="sr-only" />
      {children}
    </label>
  );
}

const EMPTY_PARAM: AgentParameter = { key: "", type: "string", label: "", description: "", required: false, secret: false };

function ParametersEditor({ params, setParams }: { params: AgentParameter[]; setParams: (p: AgentParameter[]) => void }) {
  const update = (i: number, patch: Partial<AgentParameter>) => setParams(params.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="space-y-3">
      <input type="hidden" name="parameters" value={JSON.stringify(params.filter((p) => p.key || p.label))} />
      {params.length === 0 && <p className="text-sm text-faint">Aucun réglage : l&apos;agent s&apos;installe sans rien demander.</p>}
      {params.map((p, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-line bg-black/20 p-3 sm:grid-cols-6">
          <input
            aria-label="Libellé affiché"
            placeholder="Libellé affiché (ex. Dossier à interroger)"
            value={p.label}
            onChange={(e) => update(i, { label: e.target.value, ...(p.key ? {} : { key: slugify(e.target.value).replace(/-/g, "_").slice(0, 40) }) })}
            className="input sm:col-span-3"
          />
          <input
            aria-label="Clé technique"
            placeholder="cle_technique"
            value={p.key}
            onChange={(e) => update(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
            className="input font-mono text-[13px] sm:col-span-2"
          />
          <select aria-label="Type" value={p.type} onChange={(e) => update(i, { type: e.target.value as ParameterType })} className="input sm:col-span-1">
            {(Object.keys(PARAMETER_TYPE_LABELS) as ParameterType[]).map((t) => (
              <option key={t} value={t}>
                {PARAMETER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            aria-label="Aide"
            placeholder="Aide affichée sous le champ"
            value={p.description ?? ""}
            onChange={(e) => update(i, { description: e.target.value })}
            className="input sm:col-span-4"
          />
          <input
            aria-label="Valeur par défaut"
            placeholder="Valeur par défaut"
            value={p.default === undefined ? "" : String(p.default)}
            onChange={(e) =>
              update(i, {
                default:
                  e.target.value === ""
                    ? undefined
                    : p.type === "number" && !Number.isNaN(Number(e.target.value))
                      ? Number(e.target.value)
                      : p.type === "boolean"
                        ? e.target.value === "true"
                        : e.target.value,
              })
            }
            className="input sm:col-span-2"
          />
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted sm:col-span-6">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={p.required ?? false} onChange={(e) => update(i, { required: e.target.checked })} /> Obligatoire
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={p.secret ?? false} onChange={(e) => update(i, { secret: e.target.checked })} /> Secret (mot de passe, clé)
            </label>
            <button type="button" onClick={() => setParams(params.filter((_, j) => j !== i))} className="ml-auto text-danger hover:underline">
              Retirer
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setParams([...params, { ...EMPTY_PARAM }])} className="btn-secondary">
        + Ajouter un réglage
      </button>
    </div>
  );
}

export function PublishForm({ tags, maxUploadMb, initialKind }: { tags: Tag[]; maxUploadMb: number; initialKind: AgentKind }) {
  const [state, action] = useActionState(createAgent, undefined);
  const v = state?.values ?? {};
  const str = (key: string) => (typeof v[key] === "string" ? (v[key] as string) : "");
  const formRef = useRef<HTMLFormElement>(null);

  const [kind, setKind] = useState<AgentKind>((str("kind") as AgentKind) || initialKind);
  const [standalone, setStandalone] = useState(str("standalone"));
  const [modelUses, setModelUses] = useState<string>(str("modelUses") || "host");
  const [protocol, setProtocol] = useState(str("protocol") || (initialKind === "RENTAL" ? "HTTP" : "MCP"));
  const [runtimeLanguage, setRuntimeLanguage] = useState(str("runtimeLanguage") || "node");
  const [os, setOs] = useState<string[]>(Array.isArray(v.os) ? v.os : ["win32", "darwin", "linux"]);
  const [params, setParams] = useState<AgentParameter[]>(() => {
    try {
      return str("parameters") ? JSON.parse(str("parameters")) : [];
    } catch {
      return [];
    }
  });
  const [notice, setNotice] = useState<Notice | null>(null);
  const checked = new Set(Array.isArray(v.tagIds) ? v.tagIds : []);
  const tagGroup = (group: TagGroup) => tags.filter((t) => t.group === group);
  const isDownload = kind === "DOWNLOAD";
  const installable = isDownload && protocol === "MCP" && runtimeLanguage !== "other";

  // Remplit le formulaire à partir du agent.json de l'archive choisie.
  async function prefillFromArchive(file: File | undefined) {
    setNotice(null);
    const form = formRef.current;
    if (!file || !form) return;
    let raw: unknown;
    try {
      raw = await readManifestFromArchive(file);
    } catch {
      setNotice({ tone: "error", text: "agent.json trouvé mais illisible (JSON invalide) : remplis le formulaire à la main ou corrige le fichier." });
      return;
    }
    if (!raw) {
      setNotice({ tone: "info", text: "Pas de agent.json dans l'archive : remplis la fiche ci-dessous." });
      return;
    }
    const prefill = manifestToFormValues(raw);
    for (const [name, value] of Object.entries(prefill.fields)) {
      const el = form.elements.namedItem(name);
      if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = value === "on";
      else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) el.value = value;
    }
    const f = prefill.fields;
    if (f.standalone) setStandalone(f.standalone);
    if (f.modelUses) setModelUses(f.modelUses);
    if (f.protocol && (PROTOCOLS as readonly string[]).includes(f.protocol)) setProtocol(f.protocol);
    if (f.runtimeLanguage) setRuntimeLanguage(f.runtimeLanguage);
    if (prefill.os?.length) setOs(prefill.os);
    if (prefill.parameters) setParams(prefill.parameters);

    const extra: Record<"THEME" | "TECHNOLOGY", string[]> = { THEME: [], TECHNOLOGY: [] };
    for (const [group, names] of [
      ["CATEGORY", prefill.tags.category],
      ["THEME", prefill.tags.theme],
      ["TECHNOLOGY", prefill.tags.technology],
    ] as const) {
      for (const name of names) {
        const tag = tags.find((t) => t.group === group && slugify(t.name) === slugify(name));
        const box = tag ? form.querySelector<HTMLInputElement>(`input[name="tagIds"][value="${tag.id}"]`) : null;
        if (box) box.checked = true;
        else if (group !== "CATEGORY") extra[group].push(name);
      }
    }
    for (const [group, field] of [
      ["THEME", "newThemes"],
      ["TECHNOLOGY", "newTechnologies"],
    ] as const) {
      const input = form.elements.namedItem(field) as HTMLInputElement | null;
      if (input && extra[group].length) input.value = extra[group].join(", ");
    }
    setNotice(
      prefill.schema === "agent-market/v2"
        ? { tone: "ok", text: "agent.json lu : la fiche est remplie. Vérifie chaque étape, puis publie." }
        : { tone: "info", text: "agent.json lu (ancien format) : une partie de la fiche est remplie, complète le reste (modèle, installation, réglages)." },
    );
  }

  let step = 0;
  const next = () => ++step;

  return (
    <form ref={formRef} action={action} className="mt-8 space-y-5" key={state ? JSON.stringify(v) : "new"}>
      <Step n={next()} title="Type d'agent">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["DOWNLOAD", "Téléchargeable", "J'envoie un package : code, prompts, outils. Il s'installe chez l'utilisateur, en un clic s'il s'agit d'un serveur MCP."],
              ["RENTAL", "À louer", "J'héberge le service et je fixe un prix. Les orchestrateurs le louent via Agent Market."],
            ] as const
          ).map(([value, title, help]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                kind === value ? "border-mint bg-mint/10 shadow-[0_0_0_1px_rgba(62,240,198,0.5)]" : "border-line bg-black/20 hover:border-line-strong"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => {
                  setKind(value);
                  setProtocol(value === "RENTAL" ? "HTTP" : "MCP");
                }}
                className="sr-only"
              />
              <span className="font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-muted">{help}</span>
            </label>
          ))}
        </div>
      </Step>

      {isDownload ? (
        <Step n={next()} title="Le package" hint={`Archive .zip, .tar.gz ou .tgz, ${maxUploadMb} Mo maximum. Si elle contient un agent.json, la fiche se remplit toute seule.`}>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field id="archive" label="Archive de l'agent" required>
              <input
                id="archive"
                name="archive"
                type="file"
                required
                accept=".zip,.tar.gz,.tgz"
                onChange={(e) => prefillFromArchive(e.target.files?.[0])}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-text"
              />
            </Field>
            <Field id="version" label="Version" required>
              <input id="version" name="version" required defaultValue={str("version") || "1.0.0"} className="input w-32" pattern="\d+\.\d+\.\d+.*" title="Format 1.0.0" />
            </Field>
          </div>
          {notice && (
            <p
              role="status"
              className={`rounded-xl border p-3 text-sm ${
                notice.tone === "ok" ? "border-mint/40 bg-mint/10 text-mint" : notice.tone === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-line bg-black/20 text-muted"
              }`}
            >
              {notice.text}
            </p>
          )}
        </Step>
      ) : (
        <Step n={next()} title="Location" hint="Paiement simulé pendant les tests : le prix est affiché, rien n'est débité.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="priceEuros" label="Prix (€)">
              <input id="priceEuros" name="priceEuros" inputMode="decimal" defaultValue={str("priceEuros")} className="input" placeholder="5" />
            </Field>
            <Field id="priceUnit" label="Unité">
              <input id="priceUnit" name="priceUnit" defaultValue={str("priceUnit")} className="input" placeholder="par mesh" />
            </Field>
          </div>
          <Field id="endpointUrl" label="Adresse du service" hint="Privée, jamais affichée : Agent Market y transmettra les tâches (contrat POST /jobs, GET /jobs/{id}).">
            <input id="endpointUrl" name="endpointUrl" type="url" defaultValue={str("endpointUrl")} className="input" placeholder="https://mon-serveur.example/v1" />
          </Field>
          <Field
            id="inputSchema"
            label="Entrées attendues (JSON Schema)"
            hint="Ce que l'orchestrateur doit fournir. Laisser vide pour une simple consigne en texte. Types acceptés : string, integer, number, boolean."
          >
            <textarea
              id="inputSchema"
              name="inputSchema"
              rows={6}
              defaultValue={str("inputSchema")}
              className="input font-mono text-[12px]"
              placeholder={JSON.stringify(DEFAULT_INPUT_SCHEMA, null, 2)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="outputType" label="Résultat livré">
              <select id="outputType" name="outputType" defaultValue={str("outputType")} className="input">
                <option value="">Non précisé</option>
                {Object.entries(OUTPUT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="outputFormats" label="Formats">
              <input id="outputFormats" name="outputFormats" defaultValue={str("outputFormats")} className="input" placeholder="obj, glb" />
            </Field>
            <Field id="maxMinutes" label="Délai maximal (min)">
              <input id="maxMinutes" name="maxMinutes" inputMode="numeric" defaultValue={str("maxMinutes")} className="input" placeholder="5" />
            </Field>
          </div>
        </Step>
      )}

      <Step n={next()} title="Identité">
        <Field id="name" label="Nom" required>
          <input id="name" name="name" required maxLength={80} defaultValue={str("name")} className="input" placeholder="Résumeur de documents" />
        </Field>
        <Field id="summary" label="Résumé en une phrase" required hint="Affiché sur la tuile du catalogue (160 caractères maximum).">
          <input id="summary" name="summary" required maxLength={160} defaultValue={str("summary")} className="input" placeholder="Résume un fichier texte ou Markdown de votre ordinateur." />
        </Field>
        <Field id="objective" label="Objectif" required hint="Ce que l'agent cherche à accomplir, pour qui, et ce qu'il ne fait pas.">
          <textarea id="objective" name="objective" required rows={4} defaultValue={str("objective")} className="input" placeholder="Produire un résumé fidèle d'un document texte, en gardant les chiffres et les noms propres…" />
        </Field>
        <Field id="description" label="Description détaillée" hint="Optionnel : contexte, limites connues, exemples de résultats.">
          <textarea id="description" name="description" rows={3} defaultValue={str("description")} className="input" />
        </Field>
      </Step>

      <Step n={next()} title="Classement" hint="Les visiteurs et les orchestrateurs filtrent le catalogue avec ces tags.">
        {(["CATEGORY", "THEME", "TECHNOLOGY"] as const).map((group) => (
          <div key={group}>
            <p className="label">
              {TAG_GROUP_LABELS[group]}
              {group === "CATEGORY" && <span className="text-mint"> *</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {tagGroup(group).map((t) => (
                <label key={t.id} className="chip cursor-pointer has-[:checked]:border-mint/60 has-[:checked]:bg-mint/10 has-[:checked]:text-mint">
                  <input type="checkbox" name="tagIds" value={t.id} defaultChecked={checked.has(t.id)} className="sr-only" />
                  {t.name}
                </label>
              ))}
            </div>
            {group !== "CATEGORY" && (
              <input
                name={group === "THEME" ? "newThemes" : "newTechnologies"}
                defaultValue={str(group === "THEME" ? "newThemes" : "newTechnologies")}
                className="input mt-2"
                placeholder={`Autres ${TAG_GROUP_LABELS[group].toLowerCase()}s, séparés par des virgules (5 maximum)`}
                aria-label={`Autres ${TAG_GROUP_LABELS[group].toLowerCase()}s`}
              />
            )}
          </div>
        ))}
      </Step>

      <Step n={next()} title="Ce que l'agent sait faire">
        <Field id="capabilities" label="Compétences et promesses" required hint="Une par ligne. Des engagements concrets et vérifiables.">
          <textarea
            id="capabilities"
            name="capabilities"
            required
            rows={5}
            defaultValue={str("capabilities")}
            className="input font-mono text-[13px]"
            placeholder={"Résume un fichier .txt ou .md jusqu'à 2 Mo\nTrois longueurs : court, moyen, long\nN'invente rien : signale ce que le texte ne dit pas"}
          />
        </Field>
        <Field id="tools" label="Outils" hint="Un par ligne : nom, deux-points, ce que l'outil lit ou modifie. Pour un serveur MCP, les noms de ses outils.">
          <textarea id="tools" name="tools" rows={3} defaultValue={str("tools")} className="input font-mono text-[13px]" placeholder={"resumer_document : lit un fichier texte et renvoie son résumé"} />
        </Field>
      </Step>

      <Step n={next()} title="Modèle et prompts">
        <div>
          <p className="label">
            Modèle de langage<span className="text-mint"> *</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MODEL_USE_LABELS) as ModelUse[]).map((u) => (
              <Choice key={u} name="modelUses" value={u} current={modelUses} onChange={setModelUses}>
                {MODEL_USE_LABELS[u]}
              </Choice>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="modelNames" label="Modèles recommandés" hint="Séparés par des virgules.">
            <input id="modelNames" name="modelNames" defaultValue={str("modelNames")} className="input" placeholder="llama3.2, qwen2.5:7b" />
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="modelToolCalling" defaultChecked={str("modelToolCalling") === "on"} /> Le modèle doit savoir appeler des outils
            </label>
          </div>
        </div>
        <Field id="modelNote" label="Précisions sur le modèle">
          <input id="modelNote" name="modelNote" defaultValue={str("modelNote")} className="input" placeholder="Dans Claude Desktop, c'est Claude qui raisonne et appelle les outils de l'agent." />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="promptSystem" label="Prompt système (fichier)">
            <input id="promptSystem" name="promptSystem" defaultValue={str("promptSystem")} className="input font-mono text-[13px]" placeholder="prompts/system.md" />
          </Field>
          <Field id="promptTasks" label="Prompts de tâche (un par ligne)">
            <textarea id="promptTasks" name="promptTasks" rows={2} defaultValue={str("promptTasks")} className="input font-mono text-[13px]" placeholder="prompts/resume.md" />
          </Field>
        </div>
        <Field id="promptNote" label="Note sur les prompts">
          <input id="promptNote" name="promptNote" defaultValue={str("promptNote")} className="input" placeholder="Les prompts sont des fichiers Markdown modifiables." />
        </Field>
      </Step>

      <Step n={next()} title={isDownload ? "Installation et fonctionnement" : "Fonctionnement"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="protocol" label="Mode d'appel" required>
            <select id="protocol" name="protocol" required value={protocol} onChange={(e) => setProtocol(e.target.value)} className="input">
              {PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {PROTOCOL_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          {isDownload && (
            <Field id="runtimeLanguage" label="Langage du programme">
              <select id="runtimeLanguage" name="runtimeLanguage" value={runtimeLanguage} onChange={(e) => setRuntimeLanguage(e.target.value)} className="input">
                {Object.entries(RUNTIME_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {isDownload && (
          <>
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Field id="entrypoint" label="Point d'entrée" required={protocol === "MCP"} hint="Chemin du fichier à lancer, depuis la racine du package.">
                <input id="entrypoint" name="entrypoint" defaultValue={str("entrypoint")} className="input font-mono text-[13px]" placeholder="server/index.mjs" />
              </Field>
              <Field id="runtimeVersion" label="Version requise">
                <input id="runtimeVersion" name="runtimeVersion" defaultValue={str("runtimeVersion")} className="input" placeholder=">=18" />
              </Field>
            </div>
            <p className={`rounded-xl border p-3 text-xs ${installable ? "border-mint/40 bg-mint/10 text-mint" : "border-line bg-black/20 text-muted"}`}>
              {installable
                ? `✓ Installable en un clic dans Claude Desktop : le site fabrique le paquet d'installation à partir de l'archive et de cette fiche.${runtimeLanguage === "python" ? " Python doit être installé sur l'ordinateur de l'utilisateur ; Node.js est fourni par Claude Desktop." : ""}`
                : "Installation manuelle : seul un serveur MCP (Node.js, Python ou exécutable) s'installe en un clic dans Claude Desktop."}
            </p>
          </>
        )}

        <div>
          <p className="label">
            Dépendances<span className="text-mint"> *</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Choice name="standalone" value="yes" current={standalone} onChange={setStandalone}>
              Autonome : rien d&apos;autre à installer
            </Choice>
            <Choice name="standalone" value="no" current={standalone} onChange={setStandalone}>
              Nécessite des dépendances (à lister)
            </Choice>
          </div>
          {/* Toujours présent (masqué si autonome) pour que le préremplissage puisse l'atteindre. */}
          <textarea
            name="dependencies"
            rows={3}
            defaultValue={str("dependencies")}
            hidden={standalone !== "no"}
            className="input mt-3 font-mono text-[13px]"
            placeholder={"Ollama 0.3 ou plus, lancé sur la machine\nLe modèle llama3.2 téléchargé (environ 2 Go)"}
            aria-label="Liste des dépendances"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="ramGb" label="RAM (Go)">
            <input id="ramGb" name="ramGb" inputMode="decimal" defaultValue={str("ramGb")} className="input" placeholder="8" />
          </Field>
          <Field id="vramGb" label="Mémoire GPU (Go)">
            <input id="vramGb" name="vramGb" inputMode="decimal" defaultValue={str("vramGb")} className="input" placeholder="0" />
          </Field>
          <div>
            <p className="label">Systèmes</p>
            <div className="flex flex-wrap gap-3 pt-2 text-sm text-muted">
              {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                <label key={p} className="flex items-center gap-1.5">
                  <input type="checkbox" name="os" value={p} checked={os.includes(p)} onChange={(e) => setOs(e.target.checked ? [...os, p] : os.filter((o) => o !== p))} />
                  {PLATFORM_LABELS[p]}
                </label>
              ))}
            </div>
          </div>
        </div>
        <Field id="requirementsNote" label="Précisions sur la puissance" hint="Ordre de grandeur de durée, besoin d'un GPU…">
          <input id="requirementsNote" name="requirementsNote" defaultValue={str("requirementsNote")} className="input" placeholder="Un document de 20 pages se résume en 1 à 3 minutes sans GPU." />
        </Field>

        {isDownload && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="permFiles" label="Fichiers" required>
              <select id="permFiles" name="permFiles" defaultValue={str("permFiles") || "none"} className="input">
                {Object.entries(FILE_ACCESS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="permNetwork" label="Réseau" required>
              <select id="permNetwork" name="permNetwork" defaultValue={str("permNetwork") || "none"} className="input">
                {Object.entries(NETWORK_ACCESS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="permAccounts" label="Comptes externes">
              <input id="permAccounts" name="permAccounts" defaultValue={str("permAccounts")} className="input" placeholder="Gmail, Google Drive" />
            </Field>
          </div>
        )}
      </Step>

      {isDownload && (
        <Step
          n={next()}
          title="Réglages demandés à l'installation"
          hint="Claude Desktop affiche ces champs dans sa fenêtre d'installation. Chaque valeur arrive au programme dans la variable AGENT_<CLÉ> (ex. AGENT_DOSSIER)."
        >
          <ParametersEditor params={params} setParams={setParams} />
        </Step>
      )}

      <Step n={next()} title="Pour les développeurs" hint="Facultatif : affiché dans un volet replié de la fiche.">
        <Field id="usage" label="Utilisation" hint="Commandes ou code pour lancer et tester l'agent sans l'installation en un clic.">
          <textarea id="usage" name="usage" rows={3} defaultValue={str("usage")} className="input font-mono text-[13px]" placeholder={"node server/index.mjs"} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="inputs" label="Entrées acceptées">
            <textarea id="inputs" name="inputs" rows={2} defaultValue={str("inputs")} className="input" placeholder="Le chemin d'un fichier texte" />
          </Field>
          <Field id="outputs" label="Sorties produites">
            <textarea id="outputs" name="outputs" rows={2} defaultValue={str("outputs")} className="input" placeholder="Le résumé, dans la conversation" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="license" label="Licence">
            <input id="license" name="license" defaultValue={str("license")} className="input" placeholder="MIT" />
          </Field>
          <Field id="sourceUrl" label="Code source">
            <input id="sourceUrl" name="sourceUrl" type="url" defaultValue={str("sourceUrl")} className="input" placeholder="https://github.com/…" />
          </Field>
        </div>
      </Step>

      {state?.error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <SubmitButton pendingLabel="Publication…">Publier l&apos;agent</SubmitButton>
        <span className="text-xs text-faint">L&apos;agent apparaît immédiatement dans le catalogue et pour les orchestrateurs.</span>
      </div>
    </form>
  );
}
