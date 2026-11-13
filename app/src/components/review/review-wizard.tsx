"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { btnDanger, btnGhost, btnPrimary, field, iconBtn } from "@/components/ui/forms";
import { Notice } from "@/components/ui/notice";

interface InboxItem { index: number; raw: string; date: string | null; text: string }
interface Payload {
  today: string;
  week: { label: string; monday: string; sunday: string };
  existing: { version: string; done: string[]; blocked: string; inbox: string[]; focus: string[] } | null;
  prefill: { done: string[] };
  inbox: InboxItem[];
  projects: { slug: string; title: string; status: string }[];
  focusOptions: { slug: string; project: string; text: string }[];
}
interface Draft { step: number; mode: "create" | "update"; done: string[]; blocked: string; inboxLog: string[]; focus: string[] }

const STEPS = ["Fait cette semaine", "Bloqué", "Inbox", "Focus semaine prochaine"];
const draftKey = (week: string) => `dashboard.review.${week}`;

function loadDraft(week: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(week));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function saveDraft(week: string, d: Draft | null) {
  try {
    if (d) localStorage.setItem(draftKey(week), JSON.stringify(d));
    else localStorage.removeItem(draftKey(week));
  } catch {
    /* stockage indisponible : la revue continue sans brouillon */
  }
}

export function ReviewWizard() {
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<{ path: string; focus: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await apiJson<Payload>("/api/review");
    setData(d);
    return d;
  }, []);

  useEffect(() => {
    load()
      .then((d) => {
        const saved = loadDraft(d.week.label);
        if (saved) setDraft(saved);
        else if (!d.existing) setDraft({ step: 0, mode: "create", done: d.prefill.done, blocked: "", inboxLog: [], focus: [] });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [load]);

  // Brouillon conservé dans ce navigateur : la revue survit à un rechargement de la page.
  useEffect(() => {
    if (data && draft) saveDraft(data.week.label, draft);
  }, [data, draft]);

  if (error && !data) return <Notice>{error}</Notice>;
  if (!data) return <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />;

  const week = data.week.label;

  if (finished) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <p className="mb-2 flex items-center gap-2 title-md"><Check className="size-5 text-emerald-600" aria-hidden /> Revue {week} enregistrée</p>
        <p className="mb-4 text-sm text-muted">Fichier : <code>{finished.path}</code> · DASHBOARD.md mis à jour.</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">Fait</dt><dd className="text-2xl font-semibold">{draft?.done.filter(Boolean).length ?? 0}</dd></div>
          <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">Inbox traitée</dt><dd className="text-2xl font-semibold">{draft?.inboxLog.length ?? 0}</dd></div>
          <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">Focus</dt><dd className="text-2xl font-semibold">{finished.focus.length}</dd></div>
        </dl>
        {finished.focus.length > 0 && (
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm">{finished.focus.map((f) => <li key={f}>{f}</li>)}</ol>
        )}
        <div className="mt-6 flex gap-2">
          <Link href="/" className={btnPrimary}>Retour à l&apos;accueil</Link>
          <Link href="/projets" className={btnGhost}>Voir les projets</Link>
        </div>
      </section>
    );
  }

  if (!draft) {
    // Revue déjà faite cette semaine : on propose de la modifier, jamais de l'écraser.
    const ex = data.existing!;
    return (
      <section className="rounded-2xl border border-border bg-surface p-6">
        <p className="mb-2 font-medium">La revue {week} existe déjà.</p>
        <p className="mb-4 text-sm text-muted">Tu peux la modifier : ses sections seront reprises dans les étapes.</p>
        <button type="button" className={btnPrimary}
          onClick={() => setDraft({ step: 0, mode: "update", done: ex.done, blocked: ex.blocked, inboxLog: ex.inbox, focus: ex.focus })}>
          Modifier la revue {week}
        </button>
      </section>
    );
  }

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const go = (step: number) => set({ step: Math.max(0, Math.min(STEPS.length - 1, step)) });

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiJson<{ path: string; focus: string[] }>("/api/review/finish", "POST", {
        mode: draft.mode,
        version: draft.mode === "update" ? data.existing?.version : undefined,
        done: draft.done.filter((l) => l.trim()),
        blocked: draft.blocked,
        inbox: draft.inboxLog,
        focus: draft.focus,
      });
      saveDraft(week, null);
      setFinished(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-4 gap-2" aria-label="Progression">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => go(i)} aria-current={draft.step === i ? "step" : undefined} className="w-full text-left">
              <span className={`block h-1.5 rounded-full transition-colors ${i <= draft.step ? "bg-accent" : "bg-border"}`} />
              <span className={`mt-1.5 hidden text-xs sm:block ${i === draft.step ? "font-medium text-text" : "text-muted"}`}>{i + 1}. {s}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted sm:hidden">Étape {draft.step + 1} sur 4 · {STEPS[draft.step]}</p>

      {error && <Notice>{error}</Notice>}

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <h2 className="mb-2 title-md lowercase">{STEPS[draft.step]}</h2>
        {draft.step === 0 && <DoneStep lines={draft.done} onChange={(done) => set({ done })} week={data.week} />}
        {draft.step === 1 && <BlockedStep text={draft.blocked} onChange={(blocked) => set({ blocked })} />}
        {draft.step === 2 && (
          <InboxStep
            data={data}
            log={draft.inboxLog}
            onProcessed={async (label) => {
              if (label) set({ inboxLog: [...draft.inboxLog, label] });
              await load();
            }}
          />
        )}
        {draft.step === 3 && <FocusStep options={data.focusOptions} focus={draft.focus} onChange={(focus) => set({ focus })} />}
      </section>

      <div className="flex items-center justify-between gap-2">
        <button type="button" className={btnGhost} onClick={() => go(draft.step - 1)} disabled={draft.step === 0}>
          <ArrowLeft className="size-4" aria-hidden /> Retour
        </button>
        {draft.step < STEPS.length - 1 ? (
          <button type="button" className={btnPrimary} onClick={() => go(draft.step + 1)}>
            Suivant <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : (
          <button type="button" className={btnPrimary} onClick={finish} disabled={busy}>
            {busy ? "Enregistrement…" : draft.mode === "update" ? "Enregistrer les modifications" : "Terminer la revue"}
          </button>
        )}
      </div>
      <p className="text-center text-xs text-muted">Chaque étape est facultative ; ta progression est gardée si tu recharges la page.</p>
    </div>
  );
}

function DoneStep({ lines, onChange, week }: { lines: string[]; onChange: (l: string[]) => void; week: { monday: string; sunday: string } }) {
  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Pré-rempli avec les actions cochées et les entrées de journal du {week.monday} au {week.sunday}. Modifie, retire ou ajoute des lignes.
      </p>
      <ul className="space-y-2">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2">
            <input value={l} onChange={(e) => onChange(lines.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Ligne ${i + 1}`} className={field} />
            <button type="button" className={iconBtn} aria-label="Retirer la ligne" onClick={() => onChange(lines.filter((_, j) => j !== i))}><X className="size-4" /></button>
          </li>
        ))}
      </ul>
      {lines.length === 0 && <p className="text-sm italic text-muted">Rien de noté dans les journaux cette semaine.</p>}
      <button type="button" className={`${btnGhost} mt-3`} onClick={() => onChange([...lines, ""])}><Plus className="size-4" aria-hidden /> Ajouter une ligne</button>
    </div>
  );
}

function BlockedStep({ text, onChange }: { text: string; onChange: (t: string) => void }) {
  return (
    <div>
      <p className="mb-4 text-sm text-muted">Facultatif : ce qui bloque ou attend quelqu&apos;un.</p>
      <textarea value={text} onChange={(e) => onChange(e.target.value)} rows={5} aria-label="Bloqué" className={`${field} resize-y`} placeholder="Une idée par ligne" />
    </div>
  );
}

function InboxStep({ data, log, onProcessed }: { data: Payload; log: string[]; onProcessed: (label: string | null) => Promise<void> }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [project, setProject] = useState(data.projects[0]?.slug ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = data.inbox.filter((i) => !skipped.includes(i.raw));
  const item = pending[0];

  const act = async (action: "project" | "notion" | "memo" | "delete" | "keep") => {
    if (!item) return;
    if (action === "keep") {
      setSkipped([...skipped, item.raw]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiJson<{ label: string | null }>("/api/review/inbox", "POST", { index: item.index, raw: item.raw, action, project });
      setChoosing(false);
      setConfirmDelete(false);
      await onProcessed(res.label);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        {data.inbox.length ? `${pending.length} élément(s) à trier, un par un.` : "L'inbox est vide."} Traités cette fois-ci : {log.length}.
      </p>
      {error && <div className="mb-3"><Notice>{error}</Notice></div>}
      {item ? (
        <div className="rounded-xl bg-surface-2 p-4">
          <p className="text-lg font-medium">{item.text}</p>
          {item.date && <p className="mt-1 text-xs text-muted">Noté le {item.date}</p>}
          {choosing ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Projet" className={`${field} w-auto min-w-48`}>
                {data.projects.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
              </select>
              <button type="button" className={btnPrimary} disabled={busy || !project} onClick={() => act("project")}>Ajouter comme action</button>
              <button type="button" className={btnGhost} onClick={() => setChoosing(false)}>Annuler</button>
              {!data.projects.length && <p className="w-full text-sm text-muted">Aucun projet : crée-en un depuis la page Projets.</p>}
            </div>
          ) : confirmDelete ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span>Retirer cette ligne d&apos;INBOX.md ?</span>
              <button type="button" className={btnDanger} disabled={busy} onClick={() => act("delete")}>Supprimer</button>
              <button type="button" className={btnGhost} onClick={() => setConfirmDelete(false)}>Annuler</button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} disabled={busy || !data.projects.length} onClick={() => setChoosing(true)}>Action d&apos;un projet</button>
              <button type="button" className={`${btnGhost} border border-border`} disabled={busy} onClick={() => act("notion")}>Notion</button>
              <button type="button" className={`${btnGhost} border border-border`} disabled={busy} onClick={() => act("memo")}>Mémo</button>
              <button type="button" className={`${btnGhost} border border-border hover:text-rose-600`} disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" aria-hidden /> Supprimer</button>
              <button type="button" className={btnGhost} disabled={busy} onClick={() => act("keep")}>Garder</button>
            </div>
          )}
        </div>
      ) : (
        data.inbox.length > 0 && <p className="text-sm">Tout est trié. {skipped.length > 0 && `${skipped.length} élément(s) gardé(s) pour plus tard.`}</p>
      )}
      {log.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-muted">{log.map((l, i) => <li key={i}>✓ {l}</li>)}</ul>
      )}
    </div>
  );
}

function FocusStep({ options, focus, onChange }: { options: Payload["focusOptions"]; focus: string[]; onChange: (f: string[]) => void }) {
  const [free, setFree] = useState("");
  const full = focus.length >= 3;
  const toggle = (t: string) => onChange(focus.includes(t) ? focus.filter((f) => f !== t) : full ? focus : [...focus, t]);
  return (
    <div>
      <p className="mb-4 text-sm text-muted">Jusqu&apos;à 3 éléments, parmi les prochaines actions des projets actifs ou en texte libre. Ils deviennent le « Focus de la semaine ».</p>
      {focus.length > 0 && (
        <ol className="mb-4 space-y-1.5">
          {focus.map((f, i) => (
            <li key={f} className="flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm">
              <span className="font-semibold text-accent-text">{i + 1}.</span><span className="flex-1">{f}</span>
              <button type="button" className={iconBtn} aria-label={`Retirer « ${f} »`} onClick={() => toggle(f)}><X className="size-4" /></button>
            </li>
          ))}
        </ol>
      )}
      {options.length > 0 ? (
        <ul className="mb-4 max-h-72 space-y-1 overflow-y-auto">
          {options.map((o) => {
            const label = `${o.text} (${o.project})`;
            const on = focus.includes(label);
            return (
              <li key={`${o.slug}-${o.text}`}>
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2 ${!on && full ? "opacity-50" : ""}`}>
                  <input type="checkbox" checked={on} disabled={!on && full} onChange={() => toggle(label)} className="size-4 accent-[var(--accent)]" />
                  <span>{o.text} <span className="text-muted">· {o.project}</span></span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-4 text-sm italic text-muted">Aucune prochaine action dans les projets actifs.</p>
      )}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (free.trim() && !full) { onChange([...focus, free.trim()]); setFree(""); } }}>
        <input value={free} onChange={(e) => setFree(e.target.value)} disabled={full} placeholder={full ? "3 éléments maximum" : "Ou écris un focus libre…"} aria-label="Focus libre" className={field} />
        <button type="submit" className={btnGhost} disabled={full || !free.trim()}><Plus className="size-4" aria-hidden /> Ajouter</button>
      </form>
    </div>
  );
}
