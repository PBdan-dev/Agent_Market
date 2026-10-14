"use client";

import { useActionState } from "react";
import { addVersion } from "@/app/actions/agents";
import { SubmitButton } from "@/components/SubmitButton";

export function AddVersionForm({ agentId }: { agentId: string }) {
  const [state, action] = useActionState(addVersion, undefined);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="agentId" value={agentId} />
      <label className="label" htmlFor="version">
        Nouvelle version
      </label>
      <input id="version" name="version" required placeholder="1.1.0" className="input" />
      <input name="archive" type="file" required accept=".zip,.tar.gz,.tgz" className="block w-full text-sm" />
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <SubmitButton pendingLabel="Envoi…">Publier la version</SubmitButton>
    </form>
  );
}
