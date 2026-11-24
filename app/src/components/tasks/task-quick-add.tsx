"use client";

import { CornerDownLeft } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { parseTaskInput } from "@/lib/task-input";
import { relativeDay } from "@/lib/task-format";
import { field } from "@/components/ui/forms";
import type { TasksApi } from "./use-tasks";

export interface ProjectRef { slug: string; title: string }

/** Mot en cours de frappe commençant par « # » (pour l'autocomplétion des projets). */
function hashWord(value: string, caret: number): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const m = before.match(/(^|\s)#([a-z0-9-]*)$/i);
  return m ? { start: caret - m[2].length - 1, query: m[2].toLowerCase() } : null;
}

/**
 * Saisie rapide : « Appeler la banque demain 14h #medtech ». Aperçu des morceaux reconnus avant
 * l'enregistrement (Entrée) ; date par défaut : aujourd'hui (ou `defaultDate`). « # » propose les projets.
 */
export function TaskQuickAdd({
  api, projects, today, defaultProject, placeholder = "Nouvelle tâche… (ex. « Appeler la banque demain 14h #projet »)", compact = false,
}: { api: TasksApi; projects: ProjectRef[]; today: string; defaultProject?: string; placeholder?: string; compact?: boolean }) {
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const slugs = useMemo(() => projects.map((p) => p.slug), [projects]);
  const parsed = useMemo(() => (value.trim() ? parseTaskInput(value, today, slugs) : null), [value, today, slugs]);

  const hw = hashWord(value, caret);
  // Slug déjà complet : pas de suggestions, Entrée enregistre.
  const suggestions = hw && !projects.some((p) => p.slug === hw.query) ? projects.filter((p) => p.slug.includes(hw.query) || p.title.toLowerCase().includes(hw.query)).slice(0, 6) : [];

  const pick = (slug: string) => {
    if (!hw) return;
    const next = `${value.slice(0, hw.start)}#${slug} ${value.slice(caret)}`;
    setValue(next);
    const pos = hw.start + slug.length + 2;
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const submit = async () => {
    if (!parsed || !parsed.title) return;
    const ok = await api.run({
      action: "add",
      task: {
        title: parsed.title, date: parsed.date, time: parsed.time, duration: parsed.duration,
        project: parsed.project ?? defaultProject ?? null, reminder: parsed.reminder, recurrence: parsed.recurrence,
      },
    });
    if (ok) setValue("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setSel((s) => (s + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
      return;
    }
    if (suggestions.length && (e.key === "Tab" || e.key === "Enter")) {
      e.preventDefault();
      pick(suggestions[Math.min(sel, suggestions.length - 1)].slug);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") setValue("");
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setSel(0);
          }}
          onSelect={(e) => setCaret((e.target as HTMLInputElement).selectionStart ?? 0)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Nouvelle tâche"
          maxLength={300}
          className={`${field} ${compact ? "py-1.5 text-[14px]" : ""}`}
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls="task-project-suggestions"
          aria-autocomplete="list"
        />
        <button type="button" onClick={submit} disabled={!parsed?.title || api.busy} className="grid size-9 shrink-0 place-items-center border border-border text-muted transition-colors hover:border-text hover:text-text disabled:opacity-40" aria-label="Ajouter la tâche">
          <CornerDownLeft className="size-4" aria-hidden />
        </button>
      </div>

      {suggestions.length > 0 && (
        <ul id="task-project-suggestions" role="listbox" className="absolute left-0 top-full z-20 mt-1 w-full max-w-sm border border-border bg-surface shadow-lg">
          {suggestions.map((p, i) => (
            <li key={p.slug} role="option" aria-selected={i === sel}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p.slug);
                }}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm ${i === sel ? "bg-surface-2" : ""}`}
              >
                <span>{p.title}</span>
                <span className="label text-muted">#{p.slug}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {parsed && parsed.title && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]" aria-live="polite">
          <span className="label text-muted">aperçu</span>
          <span className="max-w-full truncate font-medium">{parsed.title}</span>
          <Chip>{relativeDay(parsed.date, today)}</Chip>
          {parsed.chips.filter((c) => !parsed.dateChips.includes(c)).map((c) => <Chip key={c}>{c}</Chip>)}
          {!parsed.project && defaultProject && <Chip>#{defaultProject}</Chip>}
          {parsed.ambiguous && <span className="text-amber-700 dark:text-amber-400">date incertaine : gardée dans le titre, à corriger</span>}
          <span className="ml-auto hidden text-muted sm:inline">Entrée pour ajouter</span>
        </div>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-accent/50 bg-accent-soft px-2 py-0.5 text-accent-text">{children}</span>;
}
