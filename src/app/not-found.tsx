import Link from "next/link";

export default function NotFound() {
  return (
    <div className="animate-fade-up py-20 text-center">
      <p className="mono-label">Erreur 404</p>
      <h1 className="mt-2 text-2xl font-bold">Page introuvable</h1>
      <Link href="/" className="btn-secondary mt-6">
        Retour au catalogue
      </Link>
    </div>
  );
}
