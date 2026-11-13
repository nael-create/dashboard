"use client";

import { Check, CloudUpload, KeyRound, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EVENTS } from "@/lib/shortcuts";
import { btnGhost, btnPrimary, iconBtn } from "@/components/ui/forms";

interface Status {
  isRepo: boolean;
  branch: string | null;
  files: string[];
  count: number;
  ahead: number;
  oldestDays: number | null;
  reminderDays: number;
  pushCheck: { result: "ok" | "auth" | "network" | "other"; checkedAt: string } | null;
}
type Result =
  | { kind: "needs-confirmation"; branch: string }
  | { kind: "nothing" }
  | { kind: "ok"; message: string | null }
  | { kind: "error"; message: string; committed: boolean }
  | { kind: "push-help" };

export const SAVE_EVENT = "dashboard:save";

/**
 * Bouton « Sauvegarder » : nombre de fichiers de contenu modifiés, « À jour » sinon.
 * Rappel discret (point ambre + infobulle) si des modifications attendent depuis plus de N jours.
 */
export function SaveButton() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Result | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/save/status", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } catch {
      /* hors ligne : on réessaiera */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    const onChange = () => setTimeout(refresh, 300);
    window.addEventListener(EVENTS.contentChanged, onChange);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(t);
      window.removeEventListener(EVENTS.contentChanged, onChange);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const run = useCallback(async (confirmOtherBranch = false) => {
    setBusy(true);
    setPanel(null);
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmOtherBranch }),
      });
      const json = await res.json();
      setPanel(res.ok ? json : { kind: "error", message: json.error ?? `Erreur ${res.status}`, committed: false });
    } catch {
      setPanel({ kind: "error", message: "Le dashboard ne répond pas.", committed: false });
    } finally {
      setBusy(false);
      refresh();
    }
  }, [refresh]);

  // Action « Sauvegarder » de la palette de commandes.
  useEffect(() => {
    const onSave = () => run(false);
    window.addEventListener(SAVE_EVENT, onSave);
    return () => window.removeEventListener(SAVE_EVENT, onSave);
  }, [run]);

  // Le message de réussite s'efface seul ; les erreurs restent jusqu'à fermeture.
  useEffect(() => {
    if (panel?.kind !== "ok" && panel?.kind !== "nothing") return;
    const t = setTimeout(() => setPanel(null), 4000);
    return () => clearTimeout(t);
  }, [panel]);

  if (!status?.isRepo) return null;
  const needsLogin = status.pushCheck?.result === "auth";
  const pending = status.count + (status.ahead > 0 && status.count === 0 ? 1 : 0);
  const stale = status.oldestDays !== null && status.oldestDays >= status.reminderDays && status.count > 0;
  const title = status.count
    ? `${status.count} fichier(s) modifié(s) à sauvegarder${stale ? ` — non sauvegardé depuis ${status.oldestDays} jours` : ""}`
    : status.ahead
      ? "Une sauvegarde attend d'être envoyée sur GitHub"
      : "Tout est sauvegardé";

  return (
    <div className="relative flex items-center" ref={ref}>
      <button
        type="button"
        onClick={() => run(false)}
        disabled={busy}
        title={title}
        aria-label={pending ? `Sauvegarder (${title})` : "À jour"}
        className={`relative inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors ${
          pending ? "bg-accent-soft font-medium text-accent-text hover:bg-accent hover:text-white" : "text-muted hover:bg-surface-2 hover:text-text"
        }`}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : pending ? <CloudUpload className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
        <span className="hidden sm:inline">{pending ? "Sauvegarder" : "À jour"}</span>
        {pending > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-5 text-white">{status.count || "↑"}</span>
        )}
        {stale && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-bg bg-amber-500" aria-hidden />}
      </button>
      {needsLogin && (
        <button
          type="button"
          onClick={() => setPanel(panel?.kind === "push-help" ? null : { kind: "push-help" })}
          aria-label="L'envoi vers GitHub demande un mot de passe : voir la solution"
          title="L'envoi vers GitHub demande un mot de passe : voir la solution"
          className="ml-0.5 grid size-7 place-items-center rounded-full text-amber-600 transition-colors hover:bg-surface-2 dark:text-amber-400"
        >
          <KeyRound className="size-3.5" aria-hidden />
        </button>
      )}

      {panel && panel.kind !== "nothing" && (
        <div role="status" className="absolute right-0 top-11 z-40 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-4 text-sm shadow-xl">
          {panel.kind === "needs-confirmation" ? (
            <>
              <p className="mb-3">
                Tu es sur la branche <strong>« {panel.branch} »</strong>, pas sur « main ». La sauvegarde ira sur cette branche. Continuer ?
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" className={btnGhost} onClick={() => setPanel(null)}>Annuler</button>
                <button type="button" className={btnPrimary} onClick={() => run(true)}>Sauvegarder sur « {panel.branch} »</button>
              </div>
            </>
          ) : panel.kind === "push-help" ? (
            <PushHelp onClose={() => setPanel(null)} />
          ) : panel.kind === "ok" ? (
            <p className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> Sauvegardé et envoyé sur GitHub.
            </p>
          ) : (
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <p className="text-amber-800 dark:text-amber-300">{panel.message}</p>
                {needsLogin && <div className="mt-3 border-t border-border pt-3"><PushHelp /></div>}
              </div>
              <button type="button" onClick={() => setPanel(null)} aria-label="Fermer" className={iconBtn}><X className="size-4" /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Explication (à faire une seule fois) quand l'envoi vers GitHub demande un mot de passe. */
function PushHelp({ onClose }: { onClose?: () => void }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">GitHub demande un mot de passe pour recevoir tes sauvegardes</p>
        {onClose && <button type="button" onClick={onClose} aria-label="Fermer" className={iconBtn}><X className="size-4" /></button>}
      </div>
      <p className="text-muted">
        Tes sauvegardes restent sur cet ordinateur en attendant. À faire une seule fois pour que le bouton les envoie tout seul :
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-muted">
        <li>Télécharge et installe <strong className="text-text">GitHub CLI</strong> (fichier .pkg pour macOS) sur cli.github.com.</li>
        <li>
          Ouvre le Terminal et tape :
          <code className="mt-1 block select-all rounded-md bg-surface-2 px-2 py-1 text-xs text-text">gh auth login --hostname github.com --git-protocol https --web</code>
        </li>
        <li>Réponds « Yes » à « Authenticate Git with your GitHub credentials? », puis valide le code dans le navigateur.</li>
        <li>Relance le dashboard : ce message disparaît si tout est bon.</li>
      </ol>
      <p className="text-xs text-muted">En attendant, tu peux aussi envoyer tes sauvegardes avec « Push origin » dans GitHub Desktop.</p>
    </div>
  );
}
