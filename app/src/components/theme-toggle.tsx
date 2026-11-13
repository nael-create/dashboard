"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const ORDER = ["system", "light", "dark"] as const;
const LABELS = { system: "Thème : système", light: "Thème : clair", dark: "Thème : sombre" };
const ICONS = { system: Monitor, light: Sun, dark: Moon };

const subscribe = () => () => {};

/** Bouton qui alterne système → clair → sombre. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Évite un décalage d'hydratation : le thème n'est connu que côté navigateur.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const current = (mounted && ORDER.includes(theme as never) ? theme : "system") as (typeof ORDER)[number];
  const Icon = ICONS[current];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={LABELS[current]}
      aria-label={`${LABELS[current]} (cliquer pour changer)`}
      className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  );
}
