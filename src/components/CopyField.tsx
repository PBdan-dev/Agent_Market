"use client";

import { useState } from "react";

// Une valeur à recopier (adresse, commande) avec un bouton « Copier ».
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Presse-papiers refusé (page non sécurisée) : on sélectionne le texte pour une copie manuelle.
      const range = document.createRange();
      const el = document.getElementById(`copy-${value}`);
      if (el) {
        range.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="flex items-stretch gap-2">
      <code id={`copy-${value}`} aria-label={label} className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-xl border border-line bg-black/40 px-3 py-2.5 font-mono text-[13px] text-mint">
        {value}
      </code>
      <button type="button" onClick={copy} className="btn-secondary shrink-0">
        {copied ? "Copié ✓" : "Copier"}
      </button>
    </div>
  );
}
