"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface FlashcardData {
  term: string;
  definition: string;
  example: string;
}

/**
 * Carte qui se retourne (façon Quizlet) : la définition devant, le mot derrière.
 * Clic / toucher : retourner. Glisser à gauche / à droite (si `onSwipe`) : « À revoir » / « Je sais ».
 * Animation désactivée si l'utilisateur préfère réduire les mouvements (globals.css).
 */
export function Flashcard({
  card, flipped, onFlip, onSwipe, size = "lg", front = "definition",
}: {
  card: FlashcardData;
  flipped: boolean;
  onFlip: () => void;
  onSwipe?: (dir: "left" | "right") => void;
  size?: "sm" | "lg";
  /** Face visible au départ (dashboard.config.ts, notionsFront) : la définition (par défaut) ou le mot. */
  front?: "definition" | "term";
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);

  const height = size === "lg" ? "h-[min(52vh,420px)] min-h-[280px]" : "h-60";
  const face = "absolute inset-0 flex flex-col overflow-hidden p-5 sm:p-7 [backface-visibility:hidden] [-webkit-backface-visibility:hidden]";

  const onPointerDown = (e: React.PointerEvent) => {
    if (!onSwipe) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const x = e.clientX - s.x;
    if (Math.abs(x) > 6 && Math.abs(x) > Math.abs(e.clientY - s.y)) {
      moved.current = true;
      setDx(x);
    }
  };
  const onPointerUp = () => {
    const x = dx;
    start.current = null;
    setDx(0);
    if (onSwipe && Math.abs(x) > 90) onSwipe(x < 0 ? "left" : "right");
  };

  const termFirst = front === "term";
  const tint = dx < -40 ? "ring-2 ring-amber-500/70" : dx > 40 ? "ring-2 ring-emerald-500/70" : "";

  return (
    <div className={`relative select-none [perspective:1400px] ${height}`}>
      {/* div role="button" : la définition (Markdown) peut contenir des paragraphes ou des listes. */}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onFlip();
          }
        }}
        onClick={() => {
          if (moved.current) {
            moved.current = false;
            return;
          }
          onFlip();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
          setDx(0);
        }}
        aria-label={(flipped !== termFirst) ? `Mot : ${card.term}. Toucher pour retourner la carte.` : "Définition affichée. Toucher pour retourner la carte."}
        className={`relative block size-full cursor-pointer touch-pan-y text-left outline-offset-4 ${tint}`}
        style={{
          transformStyle: "preserve-3d",
          transform: `translateX(${dx}px) rotate(${dx / 30}deg) rotateY(${flipped ? 180 : 0}deg)`,
          transition: dx ? "none" : "transform 500ms var(--ease)",
        }}
      >
        {/* La face « devant » dépend du réglage ; l'autre est retournée de 180°. */}
        <div className={`${face} bg-surface-2`} style={termFirst ? { transform: "rotateY(180deg)" } : undefined}>
          <span className="label text-muted">Définition</span>
          <div className={`md my-auto overflow-y-auto py-4 font-light leading-snug ${size === "lg" ? "text-[clamp(1.2rem,2.4vw,1.75rem)]" : "text-[clamp(1.02rem,1.5vw,1.25rem)]"}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{card.definition}</ReactMarkdown>
          </div>
          <span className="label text-muted">{termFirst ? "Touche pour revoir le mot" : "Quel est le mot ? Touche pour retourner"}</span>
        </div>
        <div className={`${face} bg-text text-bg`} style={termFirst ? undefined : { transform: "rotateY(180deg)" }}>
          <span className="label opacity-70">Mot</span>
          <span className="my-auto block py-4">
            <span className={`block font-light leading-[1] tracking-[-0.04em] ${size === "lg" ? "text-[clamp(2.2rem,6vw,4.5rem)]" : "text-[clamp(1.7rem,3vw,2.5rem)]"}`}>
              {card.term}
            </span>
            {card.example && <span className="mt-4 block text-sm italic opacity-75">{card.example}</span>}
          </span>
          <span className="label opacity-70">{termFirst ? "Quelle est la définition ? Touche pour retourner" : "Touche pour revoir la définition"}</span>
        </div>
      </div>
    </div>
  );
}
