import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Inscription" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (await currentUser()) redirect(target);
  return <AuthForm mode="signup" next={target} />;
}
