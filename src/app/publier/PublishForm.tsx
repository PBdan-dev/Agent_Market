"use client";

import { useActionState, useState } from "react";
import { createAgent } from "@/app/actions/agents";
import { SubmitButton } from "@/components/SubmitButton";
import { PROTOCOLS, PROTOCOL_LABELS, TAG_GROUP_LABELS, type AgentKind, type TagGroup } from "@/lib/constants";

type Tag = { id: string; name: string; group: string };

function Step({ n, title, hint, children }: { n: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="card animate-fade-up space-y-4">
      <legend className="px-1">
        <span className="font-mono text-xs text-mint">{n}</span>
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

export function PublishForm({ tags, maxUploadMb, initialKind }: { tags: Tag[]; maxUploadMb: number; initialKind: AgentKind }) {
  const [state, action] = useActionState(createAgent, undefined);
  const v = state?.values ?? {};
  const str = (key: string) => (typeof v[key] === "string" ? (v[key] as string) : "");
  const [kind, setKind] = useState<AgentKind>((str("kind") as AgentKind) || initialKind);
  const [standalone, setStandalone] = useState<string>(str("standalone"));
  const checked = new Set(Array.isArray(v.tagIds) ? v.tagIds : []);
  const tagGroup = (group: TagGroup) => tags.filter((t) => t.group === group);

  return (
    <form action={action} className="mt-8 space-y-5" key={state ? JSON.stringify(v) : "new"}>
      <Step n="01" title="Type d'agent">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["DOWNLOAD", "Téléchargeable", "J'envoie un package : code, prompts, outils. L'utilisateur l'exécute chez lui."],
              ["RENTAL", "À louer", "J'héberge le service sur mon infrastructure et je fixe un prix."],
            ] as const
          ).map(([value, title, help]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                kind === value ? "border-mint bg-mint/10 shadow-[0_0_0_1px_rgba(62,240,198,0.5)]" : "border-line bg-black/20 hover:border-line-strong"
              }`}
            >
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" />
              <span className="font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-muted">{help}</span>
            </label>
          ))}
        </div>
      </Step>

      <Step n="02" title="Identité">
        <Field id="name" label="Nom" required>
          <input id="name" name="name" required maxLength={80} defaultValue={str("name")} className="input" placeholder="Résumeur de documents" />
        </Field>
        <Field id="summary" label="Résumé en une phrase" required hint="Affiché sur la tuile du catalogue (160 caractères maximum).">
          <input id="summary" name="summary" required maxLength={160} defaultValue={str("summary")} className="input" placeholder="Résume un fichier texte ou Markdown avec un modèle local." />
        </Field>
        <Field id="objective" label="Objectif" required hint="Ce que l'agent cherche à accomplir, pour qui, et ce qu'il ne fait pas.">
          <textarea id="objective" name="objective" required rows={4} defaultValue={str("objective")} className="input" placeholder="Produire un résumé fidèle d'un document texte, en gardant les chiffres et les noms propres…" />
        </Field>
        <Field id="description" label="Description détaillée" hint="Optionnel : contexte, limites connues, exemples de résultats.">
          <textarea id="description" name="description" rows={4} defaultValue={str("description")} className="input" />
        </Field>
      </Step>

      <Step n="03" title="Classement" hint="Les visiteurs filtrent le catalogue avec ces tags.">
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

      <Step n="04" title="Ce que l'agent sait faire">
        <Field id="capabilities" label="Compétences et promesses" required hint="Une par ligne. Des engagements concrets et vérifiables.">
          <textarea
            id="capabilities"
            name="capabilities"
            required
            rows={5}
            defaultValue={str("capabilities")}
            className="input font-mono text-[13px]"
            placeholder={"Résume un fichier .txt ou .md de n'importe quelle taille\nTrois longueurs : court, moyen, long\nN'invente rien : signale ce que le texte ne dit pas"}
          />
        </Field>
        <Field id="tools" label="Outils embarqués" hint="Un par ligne : nom, puis ce que l'outil lit ou modifie.">
          <textarea
            id="tools"
            name="tools"
            rows={3}
            defaultValue={str("tools")}
            className="input font-mono text-[13px]"
            placeholder={"lecture de fichier : lit le document en UTF-8\nécriture du résultat : enregistre le résumé dans <fichier>.resume.md"}
          />
        </Field>
      </Step>

      <Step n="05" title="Sous le capot" hint="Modèle, prompts, exécution, dépendances et puissance nécessaire.">
        <Field id="llmModel" label="Modèle de langage" hint="Lequel, où il tourne, comment l'obtenir ou le remplacer.">
          <textarea id="llmModel" name="llmModel" rows={2} defaultValue={str("llmModel")} className="input" placeholder="llama3.2 via Ollama en local (ollama pull llama3.2, 2 Go). Remplaçable par tout serveur compatible OpenAI." />
        </Field>
        <Field id="prompts" label="Prompts fournis" hint="Prompt système et prompts de tâche inclus dans le package.">
          <textarea id="prompts" name="prompts" rows={2} defaultValue={str("prompts")} className="input" placeholder={"Prompt système : prompts/system.md\nPrompt de tâche : prompts/resume.md"} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="runtime" label="Langage et point d'entrée">
            <input id="runtime" name="runtime" defaultValue={str("runtime")} className="input" placeholder="Python 3.10+, agent.py" />
          </Field>
          <Field id="protocol" label="Mode d'appel" required>
            <select id="protocol" name="protocol" required defaultValue={str("protocol")} className="input">
              <option value="">Choisir…</option>
              {PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {PROTOCOL_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div>
          <p className="label">
            Dépendances<span className="text-mint"> *</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["yes", "Autonome : fonctionne seul après décompression"],
                ["no", "Nécessite des dépendances (à lister)"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-xl border px-3.5 py-2 text-sm transition ${
                  standalone === value ? "border-mint bg-mint/10 text-mint" : "border-line bg-black/20 text-muted hover:border-line-strong"
                }`}
              >
                <input type="radio" name="standalone" value={value} checked={standalone === value} onChange={() => setStandalone(value)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
          {standalone === "no" && (
            <textarea
              name="dependencies"
              rows={3}
              defaultValue={str("dependencies")}
              className="input mt-3 font-mono text-[13px]"
              placeholder={"Python 3.10 ou plus\nOllama 0.3 ou plus, lancé sur la machine\nLe modèle llama3.2 téléchargé (environ 2 Go)"}
              aria-label="Liste des dépendances"
            />
          )}
        </div>
        <Field id="requirements" label="Puissance requise" hint="CPU, RAM, GPU, et un ordre de grandeur de durée.">
          <textarea id="requirements" name="requirements" rows={2} defaultValue={str("requirements")} className="input" placeholder={"RAM : 8 Go recommandés\nGPU : optionnel"} />
        </Field>
      </Step>

      <Step n="06" title="Comment l'appeler">
        <Field id="usage" label="Appel" required hint="La commande, l'adresse ou le code exact pour utiliser l'agent.">
          <textarea id="usage" name="usage" required rows={3} defaultValue={str("usage")} className="input font-mono text-[13px]" placeholder={"python agent.py mon-document.md --longueur court"} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="inputs" label="Entrées acceptées">
            <textarea id="inputs" name="inputs" rows={2} defaultValue={str("inputs")} className="input" placeholder="Un fichier .txt ou .md ; options --longueur et --langue" />
          </Field>
          <Field id="outputs" label="Sorties produites">
            <textarea id="outputs" name="outputs" rows={2} defaultValue={str("outputs")} className="input" placeholder="Le résumé dans le terminal et dans <fichier>.resume.md" />
          </Field>
        </div>
      </Step>

      {kind === "DOWNLOAD" ? (
        <Step n="07" title="Le package" hint={`Archive .zip, .tar.gz ou .tgz, ${maxUploadMb} Mo maximum, avec agent.json, README et le code.`}>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field id="archive" label="Archive de l'agent" required>
              <input
                id="archive"
                name="archive"
                type="file"
                required
                accept=".zip,.tar.gz,.tgz"
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-text"
              />
            </Field>
            <Field id="version" label="Version" required>
              <input id="version" name="version" required defaultValue={str("version") || "1.0.0"} className="input w-32" />
            </Field>
          </div>
        </Step>
      ) : (
        <Step n="07" title="Location" hint="Le paiement en ligne n'est pas encore ouvert : ces informations sont affichées à titre indicatif.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="priceEuros" label="Prix (€)">
              <input id="priceEuros" name="priceEuros" inputMode="decimal" defaultValue={str("priceEuros")} className="input" placeholder="5" />
            </Field>
            <Field id="priceUnit" label="Unité">
              <input id="priceUnit" name="priceUnit" defaultValue={str("priceUnit")} className="input" placeholder="par mesh" />
            </Field>
          </div>
          <Field id="endpointUrl" label="Adresse du service" hint="Privée, jamais affichée. Servira au branchement de la location.">
            <input id="endpointUrl" name="endpointUrl" type="url" defaultValue={str("endpointUrl")} className="input" placeholder="https://mon-serveur.example/v1" />
          </Field>
        </Step>
      )}

      <Step n="08" title="Licence et source">
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
        <span className="text-xs text-faint">L&apos;agent apparaît immédiatement dans le catalogue.</span>
      </div>
    </form>
  );
}
