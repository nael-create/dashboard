"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { defaultZoom, getZoom, setZoom, stepZoom, ZOOM_EVENT, ZOOM_LEVELS } from "@/lib/zoom";

/** Zoom du contenu : « − », le pourcentage (clic = retour à la taille par défaut), « + ». L'en-tête ne change pas. */
export function ZoomControl({ className = "" }: { className?: string }) {
  const [zoom, setLocal] = useState(1);
  const [base, setBase] = useState(1);
  useEffect(() => {
    const sync = () => {
      setLocal(getZoom());
      setBase(defaultZoom());
    };
    sync();
    window.addEventListener(ZOOM_EVENT, sync);
    return () => window.removeEventListener(ZOOM_EVENT, sync);
  }, []);

  const btn = "grid size-7 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-30";
  return (
    <span role="group" aria-label="Zoom du dashboard" className={`inline-flex items-center gap-0.5 ${className}`}>
      <button type="button" className={btn} onClick={() => setZoom(stepZoom(zoom, -1))} disabled={zoom <= ZOOM_LEVELS[0]} aria-label="Réduire le zoom" title="Réduire">
        <Minus className="size-3.5" aria-hidden />
      </button>
      <button type="button" onClick={() => setZoom(base)} title={`Revenir à ${Math.round(base * 100)} %`} aria-label={`Zoom du contenu ${Math.round(zoom * 100)} %, revenir à ${Math.round(base * 100)} %`}
        className={`min-w-[3.25rem] rounded-full px-1.5 py-1 text-center tabular-nums transition-colors hover:bg-surface-2 ${Math.abs(zoom - base) < 0.001 ? "text-muted" : "text-text"}`}>
        {Math.round(zoom * 100)} %
      </button>
      <button type="button" className={btn} onClick={() => setZoom(stepZoom(zoom, 1))} disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]} aria-label="Agrandir le zoom" title="Agrandir">
        <Plus className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
