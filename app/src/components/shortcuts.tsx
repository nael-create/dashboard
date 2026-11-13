"use client";

import { useEffect } from "react";
import { EVENTS, isTyping } from "@/lib/shortcuts";
import { OPEN_PALETTE } from "./command-palette";
import { OPEN_HELP } from "./shortcuts-help";

/**
 * Raccourcis clavier globaux : ⌘K / Ctrl+K (palette), N (nouvelle notion), ? (aide).
 * Aucun ne s'active pendant la saisie dans un champ, ni quand une fenêtre est déjà ouverte.
 */
export function Shortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTyping(e.target)) return;
      const overlayOpen = document.querySelector("dialog[open], [role=dialog][aria-modal=true]");
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!overlayOpen) window.dispatchEvent(new Event(OPEN_PALETTE));
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || overlayOpen) return;
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
