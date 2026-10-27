"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const [state, action] = useActionState<AuthState, FormData>(mode === "login" ? login : signup, undefined);
  const otherHref = `${mode === "login" ? "/inscription" : "/connexion"}?next=${encodeURIComponent(next)}`;
  const reason = next === "/publier" ? "Pour publier un agent, connecte-toi ou crée un compte." : next === "/mes-agents" ? "Connecte-toi pour voir tes agents." : null;

  return (
    <div className="mx-auto max-w-sm animate-fade-up">
      <p className="mono-label">{mode === "login" ? "Connexion" : "Inscription"}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{mode === "login" ? "Bon retour" : "Créer un compte"}</h1>
      {reason && <p className="mt-2 text-sm text-muted">{reason}</p>}
      <form action={action} className="card mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="name">
              Nom affiché
            </label>
            <input id="name" name="name" required defaultValue={state?.name} className="input" autoComplete="nickname" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">
            E-mail
          </label>
          <input id="email" name="email" type="email" required defaultValue={state?.email} className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 10 : undefined}
            className="input"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {mode === "signup" && <p className="hint">10 caractères minimum.</p>}
        </div>
        {state?.error && (
          <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
            {state.error}
          </p>
        )}
        <SubmitButton pendingLabel="Patientez…" className="btn-primary w-full">
          {mode === "login" ? "Se connecter" : "Créer mon compte"}
        </SubmitButton>
      </form>
      <p className="mt-5 text-sm text-muted">
        {mode === "login" ? "Pas encore de compte ? " : "Déjà un compte ? "}
        <Link href={otherHref} className="text-mint hover:underline">
          {mode === "login" ? "Créer un compte" : "Se connecter"}
        </Link>
      </p>
    </div>
  );
}
