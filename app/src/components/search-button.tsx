"use client";

import { Search } from "lucide-react";
import { OPEN_PALETTE } from "./command-palette";

/** Petite loupe de l'en-tête : ouvre la palette de commandes. */
export function SearchButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE))}
      aria-label="Rechercher (⌘K)"
      title="Rechercher (⌘K / Ctrl K)"
      className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      <Search className="size-[18px]" aria-hidden />
    </button>
  );
}
