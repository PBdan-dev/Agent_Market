"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const [state, action] = useActionState<AuthState, FormData>(mode === "login" ? login : signup, undefined);
  const otherHref = `${mode === "login" ? "/inscription" : "/connexion"}?next=${encodeURIComponent(next)}`;

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="name">Nom affiché</label>
            <input id="name" name="name" required defaultValue={state?.name} className="input" autoComplete="nickname" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required defaultValue={state?.email} className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Mot de passe</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 10 : undefined}
            className="input"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>
        {state?.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
        <SubmitButton pendingLabel="Patientez…">{mode === "login" ? "Se connecter" : "Créer mon compte"}</SubmitButton>
      </form>
      <p className="mt-6 text-sm text-slate-600">
        {mode === "login" ? "Pas encore de compte ? " : "Déjà un compte ? "}
        <Link href={otherHref} className="underline">
          {mode === "login" ? "Créer un compte" : "Se connecter"}
        </Link>
      </p>
    </div>
  );
}
