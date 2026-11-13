"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { iconBtn } from "@/components/ui/forms";

export const OPEN_HELP = "dashboard:open-help";

const SHORTCUTS: [string, string][] = [
  ["⌘ K  /  Ctrl K", "Ouvrir la palette de commandes (recherche, actions, capture), même pendant la saisie"],
  ["Entrée (dans la palette)", "Valider ; un texte qui ne correspond à rien est ajouté à l'inbox"],
  ["↑  ↓", "Naviguer dans les résultats"],
  ["Échap", "Fermer la palette, l'aide ou l'ajout rapide"],
  ["N", "Nouvelle notion (ajout rapide)"],
  ["?", "Afficher cette aide"],
];

/** Petit panneau d'aide des raccourcis (touche « ? »). */
export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener(OPEN_HELP, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_HELP, show);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm print:hidden" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Raccourcis clavier" className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Raccourcis clavier</h2>
          <button type="button" className={iconBtn} aria-label="Fermer" onClick={() => setOpen(false)} autoFocus><X className="size-4" /></button>
        </div>
        <dl className="space-y-2 text-sm">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4">
              <dt><kbd className="whitespace-nowrap rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-xs">{k}</kbd></dt>
              <dd className="text-right text-muted">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted">Les raccourcis à une touche (N, ?) ne s&apos;activent jamais pendant que tu écris dans un champ ; ⌘ K fonctionne partout.</p>
      </div>
    </div>
  );
}
