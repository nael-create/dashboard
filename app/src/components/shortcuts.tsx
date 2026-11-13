"use client";

import { useEffect } from "react";
import { EVENTS, isTyping } from "@/lib/shortcuts";

/** Raccourcis clavier globaux. Les raccourcis à une touche ne s'activent jamais pendant la saisie. */
export function Shortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target) || document.querySelector("dialog[open]")) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        window.dispatchEvent(new Event(EVENTS.newNotion));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
