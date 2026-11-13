"use client";

import {
  ArrowRight, CalendarCheck, CalendarDays, CornerDownLeft, FolderKanban, GraduationCap, Inbox, Layers, Mail, Newspaper,
  Palette, Plus, Save, Search, Star, StickyNote, type LucideIcon,
  Download,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { fuzzyFilter, fuzzyScore } from "@/lib/fuzzy";
import { NAV_ITEMS } from "@/lib/navigation";
import { EVENTS } from "@/lib/shortcuts";
import { SAVE_EVENT } from "./save-button";
import { UPDATE_EVENT } from "./update-button";

export const OPEN_PALETTE = "dashboard:open-palette";

type ItemType = "project" | "area" | "memo" | "notion" | "inbox" | "favorite" | "newsletter" | "news" | "event";
interface SearchItem { type: ItemType; id: string; title: string; subtitle?: string; href: string; external?: boolean }

interface Row {
  key: string;
  group: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  run: () => void | Promise<void>;
}

const GROUPS: { type: ItemType; label: string; icon: LucideIcon }[] = [
  { type: "event", label: "Agenda perso", icon: CalendarDays },
  { type: "project", label: "Projets", icon: FolderKanban },
  { type: "area", label: "Domaines", icon: Layers },
  { type: "notion", label: "Notions", icon: GraduationCap },
  { type: "memo", label: "Mémos", icon: StickyNote },
  { type: "inbox", label: "Inbox", icon: Inbox },
  { type: "favorite", label: "Favoris", icon: Star },
  { type: "newsletter", label: "Newsletters", icon: Mail },
  { type: "news", label: "Actus", icon: Newspaper },
];
const PER_GROUP = 5;

/** Palette de commandes : ⌘K / Ctrl+K, ou l'icône loupe. Recherche + actions ; Entrée sur un texte inconnu → inbox. */
export function CommandPalette() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [active, setActive] = useState(0);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setFlash(null);
    returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    const show = () => {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setOpen(true);
      setQ("");
      setActive(0);
      setFlash(null);
      apiJson<{ items: SearchItem[] }>("/api/search-index").then((d) => setItems(d.items)).catch(() => setItems([]));
    };
    window.addEventListener(OPEN_PALETTE, show);
    return () => window.removeEventListener(OPEN_PALETTE, show);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const go = useCallback((href: string, external?: boolean) => {
    close();
    if (external) window.open(href, "_blank", "noopener,noreferrer");
    else router.push(href);
  }, [close, router]);

  const addToInbox = useCallback(async (text: string) => {
    try {
      await apiJson("/api/inbox", "POST", { text });
      setFlash({ ok: true, text: `Ajouté à l'inbox : « ${text} »` });
      setQ("");
      setTimeout(close, 900);
    } catch (e) {
      setFlash({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  }, [close]);

  const rows = useMemo((): Row[] => {
    const text = q.trim();
    type Action = Row & { label: string; keywords: string };
    // Actions de création : avec un texte tapé, elles le reprennent (« Nouvelle notion : … »).
    const creations: Action[] = [
      { key: "a:notion", group: "Actions", icon: GraduationCap, label: "Nouvelle notion", title: "Nouvelle notion", keywords: "notion terme glossaire ajouter",
        run: () => { close(); window.dispatchEvent(new CustomEvent(EVENTS.newNotion, { detail: { term: "" } })); } },
      { key: "a:memo", group: "Actions", icon: StickyNote, label: "Nouveau mémo", title: "Nouveau mémo", keywords: "memo ajouter retenir", run: () => go("/memo?nouveau=1") },
      { key: "a:projet", group: "Actions", icon: FolderKanban, label: "Nouveau projet", title: "Nouveau projet", keywords: "projet creer", run: () => go("/projets?nouveau=projet") },
    ];
    const others: Action[] = [
      { key: "a:save", group: "Actions", icon: Save, label: "Sauvegarder", title: "Sauvegarder", keywords: "git github commit envoyer", run: () => { close(); window.dispatchEvent(new Event(SAVE_EVENT)); } },
      { key: "a:update", group: "Actions", icon: Download, label: "Mettre à jour le dashboard", title: "Mettre à jour le dashboard", keywords: "update mise a jour version relancer redemarrer", run: () => { close(); window.dispatchEvent(new Event(UPDATE_EVENT)); } },
      { key: "a:theme", group: "Actions", icon: Palette, label: "Changer de thème", title: "Changer de thème", subtitle: `Actuel : ${theme === "dark" ? "sombre" : theme === "light" ? "clair" : "système"}`, keywords: "theme sombre clair mode",
        run: () => { setTheme(theme === "system" ? "light" : theme === "light" ? "dark" : "system"); } },
      { key: "a:revue", group: "Actions", icon: CalendarCheck, label: "Faire la revue", title: "Faire la revue", keywords: "revue hebdomadaire semaine", run: () => go("/revue") },
      ...[...NAV_ITEMS, { href: "/revue", label: "Revue de la semaine", icon: CalendarCheck }].map((n) => ({
        key: `go:${n.href}`, group: "Aller à", icon: n.icon, label: `Aller à ${n.label}`, title: `Aller à ${n.label}`, keywords: "page", run: () => go(n.href),
      })),
    ];
    const strip = ({ label: _l, keywords: _k, ...r }: Action): Row => r;
    if (!text) return [...creations, ...others].map(strip);

    // Actions reconnues par leur nom (ex. « sauv » → Sauvegarder, « nouveau projet » → Nouveau projet).
    const named = fuzzyFilter(text, [...creations, ...others], (a) => `${a.label} ${a.keywords}`)
      .filter((a) => (fuzzyScore(text, `${a.label} ${a.keywords}`) ?? 0) >= 600); // texte présent tel quel (pas de lettres éparses)
    const namedKeys = new Set(named.map((a) => a.key));
    // Sinon, les actions de création reprennent le texte tapé.
    const prefilled: Row[] = creations.filter((c) => !namedKeys.has(c.key)).map((c) => ({
      ...strip(c),
      key: `${c.key}:texte`,
      title: `${c.label} : ${text}`,
      run: c.key === "a:notion"
        ? () => { close(); window.dispatchEvent(new CustomEvent(EVENTS.newNotion, { detail: { term: text } })); }
        : c.key === "a:memo" ? () => go(`/memo?nouveau=1&titre=${encodeURIComponent(text)}`)
        : () => go(`/projets?nouveau=projet&titre=${encodeURIComponent(text)}`),
    }));

    const results: Row[] = [];
    for (const g of GROUPS) {
      const found = fuzzyFilter(text, items.filter((i) => i.type === g.type), (i) => `${i.title} ${i.subtitle ?? ""}`, PER_GROUP);
      for (const i of found) {
        results.push({ key: `${i.type}:${i.id}`, group: g.label, icon: g.icon, title: i.title, subtitle: i.subtitle, run: () => go(i.href, i.external) });
      }
    }

    const inboxRow: Row = { key: "a:inbox", group: "Capture", icon: Inbox, title: `Ajouter à l'inbox : ${text}`, run: () => addToInbox(text) };
    // Rien ne correspond : « Ajouter à l'inbox » est l'action par défaut (Entrée).
    if (results.length === 0 && named.length === 0) return [inboxRow, ...prefilled];
    // Actions reconnues regroupées (« Actions » puis « Aller à ») pour n'afficher chaque groupe qu'une fois.
    const groupedNamed = [...named.filter((a) => a.group === "Actions"), ...named.filter((a) => a.group !== "Actions")];
    return [...groupedNamed.map(strip), ...results, ...prefilled, inboxRow];
  }, [q, items, theme, setTheme, go, close, addToInbox]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      rows[active]?.run();
    }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm print:hidden" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label="Palette de commandes" className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl" onKeyDown={onKey}>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher, ou taper une idée à noter…"
            aria-label="Rechercher ou saisir une commande"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={rows[active] ? `palette-${active}` : undefined}
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted focus-visible:outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted">Échap</kbd>
        </div>
        {flash && (
          <p className={`border-b border-border px-4 py-2 text-sm ${flash.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"}`}>{flash.text}</p>
        )}
        <ul id="palette-results" ref={listRef} role="listbox" className="max-h-[55vh] overflow-y-auto py-2">
          {rows.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <li key={r.key} role="presentation">
                {header && <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{header}</p>}
                <div
                  id={`palette-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => r.run()}
                  className={`mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm ${i === active ? "bg-accent-soft text-accent-text" : ""}`}
                >
                  <r.icon className="size-4 shrink-0 opacity-80" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.title}</span>
                    {r.subtitle && <span className="block truncate text-xs text-muted">{r.subtitle}</span>}
                  </span>
                  {i === active && (r.key.startsWith("a:") ? <CornerDownLeft className="size-3.5 shrink-0" aria-hidden /> : <ArrowRight className="size-3.5 shrink-0" aria-hidden />)}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-[11px] text-muted">
          <span>↑ ↓ pour naviguer</span><span>Entrée pour valider</span><span>? pour l&apos;aide des raccourcis</span>
          <span className="ml-auto inline-flex items-center gap-1"><Plus className="size-3" aria-hidden /> Texte inconnu + Entrée = inbox</span>
        </p>
      </div>
    </div>
  );
}
