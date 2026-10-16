import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "./actions/auth";
import { Background } from "@/components/Background";
import { MotionGuard } from "@/components/MotionGuard";
import { SiteNav } from "@/components/SiteNav";
import { currentUser } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Agent Market", template: "%s · Agent Market" },
  description: "Téléchargez et louez des agents IA, classés par catégorie, thème et technologie.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col">
        <Background />
        <MotionGuard />
        <SiteNav user={user ? { name: user.name } : null} logout={logout} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        <footer className="border-t border-line py-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>Agent Market · le code des agents téléchargeables est publié par leurs auteurs et n&apos;est pas audité par la plateforme.</span>
            <Link href="/format" className="hover:text-muted">
              Format d&apos;un package d&apos;agent
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
