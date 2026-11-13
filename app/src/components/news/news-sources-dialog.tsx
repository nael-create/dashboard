"use client";

import { Check, Lock, Plus, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { btnDanger, btnGhost, btnPrimary, chip, field, iconBtn } from "@/components/ui/forms";
import type { NewsData, NewsSourceData } from "./use-news";

const PRESETS = ["#e0785a", "#0d7680", "#990f3d", "#f97316", "#6366f1", "#10b981", "#0ea5e9", "#8b5cf6"];

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((c) => (
        <button key={c} type="button" aria-label={c} aria-pressed={value === c} onClick={() => onChange(c)}
          className="grid size-6 place-items-center rounded-full transition-transform hover:scale-110" style={{ background: c }}>
          {value === c && <Check className="size-3.5 text-white" />}
        </button>
      ))}
      <label className="relative grid size-6 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-border text-muted" title="Autre couleur">
        <Plus className="size-3.5" />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Autre couleur" />
      </label>
    </div>
  );
}

export function NewsSourcesDialog({
  open, onClose, data, onChanged,
}: { open: boolean; onClose: () => void; data: NewsData; onChanged: () => Promise<void> | void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const catList = useId();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const categories = [...new Set(data.sources.map((s) => s.category))].sort((a, b) => a.localeCompare(b, "fr"));

  const call = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(620px,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-text shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <datalist id={catList}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
        <header className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Sources d&apos;actus</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className={iconBtn}><X className="size-4" /></button>
        </header>

        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Un widget par :</span>
          {(["source", "category"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={data.mode === m} className={chip(data.mode === m)}
              onClick={() => call(() => apiJson("/api/news/layout", "PATCH", { version: data.version, mode: m }))}>
              {m === "source" ? "source" : "catégorie"}
            </button>
          ))}
        </div>

        {error && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>}

        <ul className="mb-6 space-y-2">
          {data.sources.map((s) => <SourceRow key={s.id} s={s} version={data.version} catList={catList} call={call} />)}
        </ul>

        <AddSource version={data.version} catList={catList} call={call} used={data.sources.map((s) => s.color)} />
      </div>
    </dialog>
  );
}

function SourceRow({
  s, version, catList, call,
}: { s: NewsSourceData; version: string; catList: string; call: (fn: () => Promise<unknown>) => Promise<boolean> }) {
  const [name, setName] = useState(s.name);
  const [category, setCategory] = useState(s.category);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setName(s.name); setCategory(s.category); }, [s.name, s.category]);
  const patch = (body: Record<string, unknown>) =>
    call(() => apiJson(`/api/news/sources/${encodeURIComponent(s.id)}`, "PATCH", { version, ...body }));

  return (
    <li className={`rounded-xl border border-border p-3 ${s.enabled ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-2">
        <span className="size-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom de la source"
          onBlur={() => name.trim() && name.trim() !== s.name && patch({ name: name.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 font-medium outline-none hover:bg-surface-2 focus:bg-surface-2" />
        {s.private && <span title="Lien privé : stocké uniquement sur ton ordinateur" className="text-muted"><Lock className="size-3.5" /></span>}
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={s.enabled} onChange={(e) => patch({ enabled: e.target.checked })} className="size-4 accent-[var(--accent)]" />
          Active
        </label>
        {confirming ? (
          <span className="flex items-center gap-1 text-sm">
            <button type="button" className={btnDanger} onClick={() => call(() => apiJson(`/api/news/sources/${encodeURIComponent(s.id)}?version=${version}`, "DELETE"))}>Retirer</button>
            <button type="button" className={btnGhost} onClick={() => setConfirming(false)}>Non</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} aria-label={`Retirer « ${s.name} »`} className={`${iconBtn} hover:text-rose-600`}><Trash2 className="size-4" /></button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 pl-5">
        <Swatches value={s.color} onChange={(c) => patch({ color: c })} />
        <input value={category} list={catList} onChange={(e) => setCategory(e.target.value)} aria-label="Catégorie"
          onBlur={() => category.trim() && category.trim() !== s.category && patch({ category: category.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-32 rounded-md border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-accent" />
        <span className="ml-auto text-xs text-muted">{s.host}</span>
      </div>
    </li>
  );
}

function AddSource({
  version, catList, call, used,
}: { version: string; catList: string; call: (fn: () => Promise<unknown>) => Promise<boolean>; used: string[] }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState(PRESETS.find((c) => !used.includes(c)) ?? PRESETS[0]);
  const [priv, setPriv] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await call(() => apiJson("/api/news/sources", "POST", { version, name, url, category, color, private: priv }));
    setBusy(false);
    if (ok) { setName(""); setUrl(""); setPriv(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-surface-2 p-4">
      <h3 className="font-medium">Ajouter une source</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="Nom (ex. FT Tech)" aria-label="Nom" className={field} />
        <input value={category} onChange={(e) => setCategory(e.target.value)} required maxLength={40} list={catList} placeholder="Catégorie (ex. Tech)" aria-label="Catégorie" className={field} />
      </div>
      <input value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="Lien du flux RSS (https://…)" aria-label="Lien du flux RSS" autoComplete="off" spellCheck={false} className={`${field} font-mono text-xs`} />
      <Swatches value={color} onChange={setColor} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span>
          <span className="font-medium">Lien privé</span>
          <span className="block text-xs text-muted">À cocher si le lien contient une clé personnelle (ex. flux myFT). Il restera sur ton ordinateur (app/data/news.local.json) et n&apos;ira jamais sur GitHub.</span>
        </span>
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Vérification du flux…" : "Ajouter"}</button>
    </form>
  );
}
