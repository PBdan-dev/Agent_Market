import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <Link href="/" className="mt-4 inline-block text-slate-600 underline">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
