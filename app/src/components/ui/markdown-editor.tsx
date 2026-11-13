"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { btnGhost, btnPrimary, field } from "./forms";

/** Éditeur Markdown simple : onglets « Écrire » / « Aperçu », Enregistrer / Annuler. */
export function MarkdownEditor({
  initial, onSave, onCancel, rows = 8, label,
}: { initial: string; onSave: (text: string) => Promise<boolean>; onCancel: () => void; rows?: number; label: string }) {
  const [text, setText] = useState(initial);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-xl border border-border">
      <div role="tablist" className="flex gap-1 border-b border-border px-2 pt-2">
        {([["write", "Écrire"], ["preview", "Aperçu"]] as const).map(([id, l]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px rounded-t-lg border-b-2 px-3 py-1.5 text-sm ${tab === id ? "border-accent font-medium" : "border-transparent text-muted hover:text-text"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="p-3">
        {tab === "write" ? (
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={rows} aria-label={label} autoFocus
            className={`${field} resize-y font-mono text-[13px] leading-relaxed`}
            placeholder="Markdown : **gras**, *italique*, - liste, [lien](https://…)" />
        ) : (
          <div className="md min-h-24 rounded-lg bg-surface-2 p-3 text-sm">
            {text.trim() ? <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{text}</ReactMarkdown> : <p className="text-muted">Rien à afficher.</p>}
          </div>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={btnGhost}>Annuler</button>
          <button type="button" disabled={busy} className={btnPrimary}
            onClick={async () => { setBusy(true); await onSave(text); setBusy(false); }}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
