"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";
import { loginSchema, signupSchema } from "@/lib/validation";

export type AuthState = { error?: string; email?: string; name?: string } | undefined;

// Évite les redirections ouvertes : seuls les chemins internes sont acceptés.
function safeNext(raw: FormDataEntryValue | null): string {
  const next = typeof raw === "string" ? raw : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const echo = { email: String(formData.get("email") ?? ""), name: String(formData.get("name") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, ...echo };

  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) {
    return { error: "Un compte existe déjà avec cet e-mail.", ...echo };
  }
  const user = await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12) },
  });
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const echo = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, ...echo };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok) return { error: "E-mail ou mot de passe incorrect.", ...echo };

  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
