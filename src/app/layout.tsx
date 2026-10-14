import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "./actions/auth";
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
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Agent Market
            </Link>
            <Link href="/telecharger" className="text-sm text-slate-700 hover:text-slate-950">
              Téléchargeables
            </Link>
            <Link href="/louer" className="text-sm text-slate-700 hover:text-slate-950">
              À louer
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <Link href="/publier" className="btn-primary">
                Publier un agent
              </Link>
              {user ? (
                <>
                  <Link href="/mes-agents" className="text-sm text-slate-700 hover:text-slate-950">
                    Mes agents
                  </Link>
                  <form action={logout}>
                    <button className="text-sm text-slate-500 hover:text-slate-900">Déconnexion</button>
                  </form>
                </>
              ) : (
                <Link href="/connexion" className="text-sm text-slate-700 hover:text-slate-950">
                  Connexion
                </Link>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          Agent Market · Le code des agents téléchargeables est publié par leurs auteurs et n&apos;est pas audité par la
          plateforme.
        </footer>
      </body>
    </html>
  );
}
