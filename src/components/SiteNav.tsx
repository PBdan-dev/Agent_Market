"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavUser = { name: string } | null;

const LINKS = [
  { href: "/", label: "Catalogue" },
  { href: "/telecharger", label: "Téléchargeables" },
  { href: "/louer", label: "À louer" },
  { href: "/format", label: "Format d'agent" },
];

export function SiteNav({ user, logout }: { user: NavUser; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const current = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
          <span className="logo-dot" />
          Agent<span className="text-mint">Market</span>
        </Link>

        <div className="hidden items-center gap-6 text-sm md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="nav-link" aria-current={current(l.href)}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Link href="/mes-agents" className="btn-ghost" aria-current={current("/mes-agents")}>
                Mes agents
              </Link>
              <form action={logout}>
                <button className="btn-ghost">Déconnexion</button>
              </form>
            </>
          ) : (
            <Link href="/connexion" className="btn-ghost">
              Connexion
            </Link>
          )}
          <Link href="/publier" className="btn-primary">
            Publier un agent
          </Link>
        </div>

        <button
          type="button"
          className="ml-auto rounded-lg border border-line p-2 text-muted md:hidden"
          aria-expanded={open}
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="menu-panel border-t border-line bg-bg-2/95 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l, i) => (
              <Link
                key={l.href}
                href={l.href}
                className="animate-fade-up rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface-2 hover:text-text aria-[current=page]:text-mint"
                style={{ animationDelay: `${i * 40}ms` }}
                aria-current={current(l.href)}
              >
                {l.label}
              </Link>
            ))}
            {user && (
              <Link href="/mes-agents" className="rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface-2 hover:text-text">
                Mes agents
              </Link>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <Link href="/publier" className="btn-primary flex-1">
              Publier un agent
            </Link>
            {user ? (
              <form action={logout}>
                <button className="btn-secondary">Déconnexion</button>
              </form>
            ) : (
              <Link href="/connexion" className="btn-secondary">
                Connexion
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
