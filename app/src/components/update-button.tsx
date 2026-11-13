"use client";

import { Download, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { btnGhost, btnPrimary } from "@/components/ui/forms";

export const UPDATE_EVENT = "dashboard:update";

type State = { service: boolean; behind: number | null };
type Phase = "idle" | "confirm" | "restarting" | "slow" | "error";

/** Attend que le serveur se soit arrêté puis soit revenu (au plus ~4 minutes). */
async function waitForRestart(onSlow: () => void): Promise<boolean> {
  const ping = async () => {
    try {
      return (await fetch("/api/save/status", { cache: "no-store" })).ok;
    } catch {
      return false;
    }
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let wentDown = false;
  for (let i = 0; i < 120; i++) {
    await sleep(2000);
    const up = await ping();
    if (!up) wentDown = true;
    else if (wentDown || i > 10) return true;
    if (i === 45) onSlow();
  }
  return false;
}

/**
 * « Mettre à jour » : visible dans l'en-tête seulement quand une nouvelle version existe sur GitHub
 * (et toujours accessible depuis la palette). Un clic relance le dashboard, qui se met à jour au démarrage.
 */
export function UpdateButton() {
  const [state, setState] = useState<State | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");

  const check = useCallback(async (force = false) => {
    try {
      const res = await fetch(`/api/app/update${force ? "?check=1" : ""}`, { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } catch {
      /* hors ligne */
    }
  }, []);

  useEffect(() => {
    check();
    const t = setInterval(() => check(), 30 * 60_000);
    return () => clearInterval(t);
  }, [check]);

  const start = useCallback(async () => {
    setPhase("restarting");
    try {
      const res = await fetch("/api/app/update", { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setMessage(json.error ?? `Erreur ${res.status}`);
        setPhase("error");
        return;
      }
    } catch {
      /* le serveur s'arrête : normal */
    }
    const ok = await waitForRestart(() => setPhase("slow"));
    if (ok) window.location.reload();
    else {
      setMessage("Le dashboard n'est pas revenu. Redémarre le Mac ; s'il ne revient toujours pas, le journal est dans ~/Library/Logs/dashboard.log.");
      setPhase("error");
    }
  }, []);

  // Depuis la palette : vérifie d'abord, puis propose.
  useEffect(() => {
    const onEvent = async () => {
      await check(true);
      setPhase("confirm");
    };
    window.addEventListener(UPDATE_EVENT, onEvent);
    return () => window.removeEventListener(UPDATE_EVENT, onEvent);
  }, [check]);

  const available = !!state?.behind;

  return (
    <>
      {available && phase === "idle" && (
        <button
          type="button"
          onClick={() => setPhase("confirm")}
          className="label mr-1 inline-flex h-9 items-center gap-1.5 rounded-full border border-accent px-3 text-accent-text transition-colors hover:bg-accent hover:text-white"
          title="Une nouvelle version du dashboard est disponible"
        >
          <Download className="size-3.5" aria-hidden /> Mettre à jour
        </button>
      )}

      {/* Rendu hors de l'en-tête (son flou enfermerait la fenêtre). */}
      {phase !== "idle" && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Mise à jour du dashboard" className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-sm normal-case tracking-normal">
          <div className="w-[min(440px,100%)] border border-border bg-bg p-6 text-text">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-[clamp(1.4rem,3vw,1.9rem)] font-light lowercase leading-tight tracking-[-0.03em]">mise à jour</h2>
              {(phase === "confirm" || phase === "error") && (
                <button type="button" onClick={() => setPhase("idle")} aria-label="Fermer" className="text-muted hover:text-text"><X className="size-4" /></button>
              )}
            </div>
            {phase === "confirm" && (
              <>
                <p className="text-sm leading-relaxed">
                  {state?.behind
                    ? `Une nouvelle version est disponible (${state.behind} changement${state.behind > 1 ? "s" : ""}).`
                    : state?.behind === 0
                      ? "Tu as déjà la dernière version. Tu peux quand même relancer le dashboard."
                      : "Impossible de vérifier GitHub pour le moment. Tu peux quand même relancer le dashboard."}{" "}
                  Le dashboard va se relancer (≈ 30 secondes, plus après une grosse mise à jour). Ton contenu n&apos;est pas touché.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" className={btnGhost} onClick={() => setPhase("idle")}>Annuler</button>
                  <button type="button" className={btnPrimary} onClick={start} autoFocus>Mettre à jour</button>
                </div>
              </>
            )}
            {(phase === "restarting" || phase === "slow") && (
              <p className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {phase === "slow" ? "Installation en cours, encore un peu de patience…" : "Le dashboard se met à jour et redémarre…"}
              </p>
            )}
            {phase === "error" && <p className="text-sm leading-relaxed">{message}</p>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
