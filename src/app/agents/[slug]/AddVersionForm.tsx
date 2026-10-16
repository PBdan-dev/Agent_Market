"use client";

import { useActionState } from "react";
import { addVersion } from "@/app/actions/agents";
import { SubmitButton } from "@/components/SubmitButton";

export function AddVersionForm({ agentId }: { agentId: string }) {
  const [state, action] = useActionState(addVersion, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="agentId" value={agentId} />
      <div>
        <label className="label" htmlFor="version">
          Nouvelle version
        </label>
        <input id="version" name="version" required placeholder="1.1.0" className="input w-32" />
      </div>
      <div>
        <label className="label" htmlFor="archive">
          Archive
        </label>
        <input id="archive" name="archive" type="file" required accept=".zip,.tar.gz,.tgz" className="block text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-text" />
      </div>
      <SubmitButton pendingLabel="Envoi…">Publier la version</SubmitButton>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
