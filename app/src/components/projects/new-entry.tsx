"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { btnGhost, btnPrimary, field } from "@/components/ui/forms";
import { DatePopover } from "@/components/ui/date-popover";
import { deadlineChip, deadlinePresets } from "@/lib/fr-dates";

/**
 * « Nouveau projet » (titre + deadline facultative, même fenêtre de choix que sur la page projet) /
 * « Nouveau domaine » (titre seul). Ouvre ensuite la page, la saisie de tâche prête.
 */
export function NewEntryButtons({ today }: { today: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<"project" | "area" | null>(null);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Arrivée depuis la palette (« Nouveau projet »).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("nouveau") === "projet") {
      setKind("project");
      setTitle(sp.get("titre") ?? "");
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kind) return;
    setBusy(true);
    setError(null);
    try {
      const { slug } = await apiJson<{ slug: string }>(`/api/entries/${kind}`, "POST", { title, deadline: kind === "project" ? deadline : null });
      router.push(`/${kind === "project" ? "projets" : "domaines"}/${slug}?nouveau=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button type="button" className={btnPrimary} onClick={() => { setKind("project"); setTitle(""); setDeadline(null); }}><Plus className="size-4" aria-hidden /> Nouveau projet</button>
        <button type="button" className={`${btnGhost} border border-border`} onClick={() => { setKind("area"); setTitle(""); }}><Plus className="size-4" aria-hidden /> Nouveau domaine</button>
      </div>
      {kind && (
        <form onSubmit={submit} className="flex w-full max-w-md flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3 sm:w-[28rem]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required maxLength={120}
            placeholder={kind === "project" ? "Titre du projet" : "Titre du domaine (ex. Santé)"} aria-label="Titre" className={`${field} min-w-0 flex-1`}
            onKeyDown={(e) => e.key === "Escape" && setKind(null)} />
          {kind === "project" && (
            <span className="relative">
              <button type="button" onClick={() => setPicking((p) => !p)} aria-haspopup="dialog" aria-expanded={picking}
                className={deadline ? "rounded-full border border-text/60 px-3 py-1 text-[13px]" : "rounded-full border border-dashed border-border px-3 py-1 text-[13px] text-muted hover:border-text hover:text-text"}>
                {deadline ? deadlineChip(deadline, today).text : "+ deadline"}
              </button>
              {picking && <DatePopover label="Deadline du projet" align="right" presets={deadlinePresets(today)} value={deadline} today={today} onPick={(d) => { setPicking(false); setDeadline(d); }} onClose={() => setPicking(false)} />}
            </span>
          )}
          <button type="submit" disabled={busy || !title.trim()} className={btnPrimary}>Créer</button>
          <button type="button" className={btnGhost} onClick={() => setKind(null)}>Annuler</button>
          <p className="w-full text-xs text-muted">{kind === "project" ? "Créé en « idée », priorité P3 ; deadline facultative." : "Créé en priorité P3."} Tu ajoutes ensuite les tâches sur sa page.</p>
          {error && <p className="w-full text-sm text-rose-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
