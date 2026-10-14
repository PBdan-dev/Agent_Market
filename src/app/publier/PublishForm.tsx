"use client";

import { useActionState, useState } from "react";
import { createAgent } from "@/app/actions/agents";
import { SubmitButton } from "@/components/SubmitButton";
import { TAG_GROUP_LABELS, type AgentKind, type TagGroup } from "@/lib/constants";

type Tag = { id: string; name: string; group: string };

export function PublishForm({ tags, maxUploadMb, initialKind }: { tags: Tag[]; maxUploadMb: number; initialKind: AgentKind }) {
  const [state, action] = useActionState(createAgent, undefined);
  const v = state?.values ?? {};
  const [kind, setKind] = useState<AgentKind>((v.kind as AgentKind) ?? initialKind);
  const str = (key: string) => (typeof v[key] === "string" ? (v[key] as string) : "");
  const checked = new Set(Array.isArray(v.tagIds) ? v.tagIds : []);

  const tagGroup = (group: TagGroup) => tags.filter((t) => t.group === group);

  return (
    <form action={action} className="mt-6 space-y-6" key={state ? JSON.stringify(v) : "new"}>
      <fieldset>
        <legend className="label">Type d&apos;agent</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["DOWNLOAD", "Téléchargeable", "J'envoie une archive de code."],
              ["RENTAL", "À louer", "J'héberge le service et je fixe un prix."],
            ] as const
          ).map(([value, title, help]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border p-4 ${kind === value ? "border-slate-900 bg-white ring-2 ring-slate-900" : "border-slate-300 bg-white"}`}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              <span className="font-medium">{title}</span>
              <span className="mt-1 block text-sm text-slate-600">{help}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="name">Nom</label>
        <input id="name" name="name" required maxLength={80} defaultValue={str("name")} className="input" placeholder="Agent Gmail" />
      </div>
      <div>
        <label className="label" htmlFor="summary">Résumé (une phrase)</label>
        <input id="summary" name="summary" required maxLength={200} defaultValue={str("summary")} className="input" placeholder="Lit, trie et rédige vos e-mails Gmail." />
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          required
          rows={8}
          defaultValue={str("description")}
          className="input"
          placeholder="Ce que fait l'agent, comment l'installer ou l'appeler, les accès nécessaires, les limites connues…"
        />
      </div>

      <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold">Classement</legend>
        {(["CATEGORY", "THEME", "TECHNOLOGY"] as const).map((group) => (
          <div key={group}>
            <p className="label">
              {TAG_GROUP_LABELS[group]}
              {group === "CATEGORY" && " (au moins une)"}
            </p>
            <div className="flex flex-wrap gap-2">
              {tagGroup(group).map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 text-sm has-[:checked]:border-slate-900 has-[:checked]:bg-slate-900 has-[:checked]:text-white">
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
                placeholder="Autres, séparés par des virgules (5 maximum)"
                aria-label={`Autres ${TAG_GROUP_LABELS[group].toLowerCase()}s`}
              />
            )}
          </div>
        ))}
      </fieldset>

      {kind === "DOWNLOAD" ? (
        <fieldset className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Fichier</legend>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="archive">Archive de l&apos;agent</label>
            <input id="archive" name="archive" type="file" required accept=".zip,.tar.gz,.tgz" className="block w-full text-sm" />
            <p className="mt-1 text-xs text-slate-500">.zip, .tar.gz ou .tgz, {maxUploadMb} Mo maximum. Incluez un README.</p>
          </div>
          <div>
            <label className="label" htmlFor="version">Version</label>
            <input id="version" name="version" required defaultValue={str("version") || "1.0.0"} className="input" />
          </div>
        </fieldset>
      ) : (
        <fieldset className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Location</legend>
          <div>
            <label className="label" htmlFor="priceEuros">Prix (€)</label>
            <input id="priceEuros" name="priceEuros" inputMode="decimal" defaultValue={str("priceEuros")} className="input" placeholder="5" />
          </div>
          <div>
            <label className="label" htmlFor="priceUnit">Unité</label>
            <input id="priceUnit" name="priceUnit" defaultValue={str("priceUnit")} className="input" placeholder="par requête" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="endpointUrl">Point d&apos;accès du service (privé, optionnel)</label>
            <input id="endpointUrl" name="endpointUrl" type="url" defaultValue={str("endpointUrl")} className="input" placeholder="https://mon-serveur.example/agent" />
            <p className="mt-1 text-xs text-slate-500">Non affiché publiquement. Servira au branchement de la location.</p>
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="license">Licence (optionnel)</label>
          <input id="license" name="license" defaultValue={str("license")} className="input" placeholder="MIT" />
        </div>
        <div>
          <label className="label" htmlFor="sourceUrl">Code source (optionnel)</label>
          <input id="sourceUrl" name="sourceUrl" type="url" defaultValue={str("sourceUrl")} className="input" placeholder="https://github.com/…" />
        </div>
      </div>

      {state?.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      <SubmitButton pendingLabel="Publication…">Publier</SubmitButton>
    </form>
  );
}
