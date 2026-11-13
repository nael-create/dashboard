"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { btnGhost, btnPrimary, field } from "@/components/ui/forms";

/** « Nouveau projet » / « Nouveau domaine » : seul le titre est demandé, le reste vient du template. */
export function NewEntryButtons() {
  const router = useRouter();
  const [kind, setKind] = useState<"project" | "area" | null>(null);
  const [title, setTitle] = useState("");
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
      const { slug } = await apiJson<{ slug: string }>(`/api/entries/${kind}`, "POST", { title });
      router.push(`/${kind === "project" ? "projets" : "domaines"}/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button type="button" className={btnPrimary} onClick={() => { setKind("project"); setTitle(""); }}><Plus className="size-4" aria-hidden /> Nouveau projet</button>
        <button type="button" className={`${btnGhost} border border-border`} onClick={() => { setKind("area"); setTitle(""); }}><Plus className="size-4" aria-hidden /> Nouveau domaine</button>
      </div>
      {kind && (
        <form onSubmit={submit} className="flex w-full max-w-md flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3 sm:w-[28rem]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required maxLength={120}
            placeholder={kind === "project" ? "Titre du projet" : "Titre du domaine (ex. Santé)"} aria-label="Titre" className={`${field} min-w-0 flex-1`}
            onKeyDown={(e) => e.key === "Escape" && setKind(null)} />
          <button type="submit" disabled={busy || !title.trim()} className={btnPrimary}>Créer</button>
          <button type="button" className={btnGhost} onClick={() => setKind(null)}>Annuler</button>
          <p className="w-full text-xs text-muted">Créé depuis le modèle : {kind === "project" ? "idée, P3" : "actif, P3"}, le reste à « TODO: fill in ».</p>
          {error && <p className="w-full text-sm text-rose-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
