"use client";

import { useEffect } from "react";
import { EVENTS, isTyping } from "@/lib/shortcuts";
import { OPEN_PALETTE } from "./command-palette";
import { OPEN_HELP } from "./shortcuts-help";

/**
 * Raccourcis clavier globaux.
 * - ⌘K / Ctrl+K (palette) : actif PARTOUT, y compris pendant la saisie dans un champ.
 * - N (nouvelle notion) et ? (aide) : jamais pendant la saisie, ni quand une fenêtre est déjà ouverte.
 */
export function Shortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const overlayOpen = document.querySelector("dialog[open], [role=dialog][aria-modal=true]");
      // Raccourci à modificateur : fonctionne même pendant la saisie.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!document.querySelector("[aria-label='Palette de commandes']")) window.dispatchEvent(new Event(OPEN_PALETTE));
        return;
      }
      // Raccourcis à une touche : jamais pendant la saisie.
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || overlayOpen) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        window.dispatchEvent(new Event(EVENTS.newNotion));
      } else if (e.key === "?") {
        e.preventDefault();
        window.dispatchEvent(new Event(OPEN_HELP));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
