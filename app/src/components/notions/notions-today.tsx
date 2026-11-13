"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { afterAnswer } from "@/lib/leitner";
import { Flashcard } from "./flashcard";

interface DueNotion { id: string; term: string; definition: string; example: string; tags: string[]; box: number }
interface DuePayload { items: DueNotion[]; totalDue: number; learned: number; total: number; front?: "definition" | "term" }

/**
 * « À retenir aujourd'hui » : révision passive, jamais obligatoire.
 * Face visible réglable (dashboard.config.ts, notionsFront) : la définition d'abord (retrouver le mot)
 * ou le terme d'abord ; un clic révèle l'autre face ; « Je savais » / « À revoir ».
 * Une notion ignorée reste simplement à revoir.
 */
export function NotionsToday({ n }: { n?: string } = {}) {
  const [data, setData] = useState<DuePayload | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [batchDone, setBatchDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiJson<DuePayload>("/api/notions/due");
      setData(d);
      setIndex(0);
      setRevealed(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = data?.items[index];

  const answer = async (knew: boolean) => {
    if (!current) return;
    try {
      await apiJson("/api/notions/review", "POST", { id: current.id, result: knew ? "knew" : "again" });
      const { days } = afterAnswer(current.box, knew);
      setNote(`« ${current.term} » revient ${days <= 1 ? "demain" : `dans ${days} jours`}.`);
      setRevealed(false);
      if (data && index + 1 >= data.items.length) {
        // Série terminée : on recharge les compteurs ; « Encore » propose la suite s'il en reste.
        await load();
        setBatchDone(true);
      } else {
        setIndex((i) => i + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };


  return (
    <section className="rise flex h-full flex-col border-t border-text/80 pt-4 sm:pt-5">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 className="flex items-baseline gap-3">
          {n && <span className="label text-muted">{n}.</span>}
          <span className="title-md lowercase">À retenir aujourd&apos;hui</span>
        </h2>
        <Link href="/notions?onglet=travailler" className="label link-underline inline-flex items-center gap-1 pt-1 text-muted hover:text-text">
          Travailler <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      </header>

      {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}

      {!data ? (
        <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
      ) : batchDone ? (
        <div className="flex flex-1 flex-col justify-center rounded-xl bg-surface-2 p-4 text-sm">
          <p className="font-medium">C&apos;est fait pour cette série.</p>
          <p className="mt-1 text-muted">{data.learned} notion(s) apprise(s) sur {data.total}.</p>
          {data.items.length > 0 && (
            <button type="button" onClick={() => setBatchDone(false)} className="mt-3 self-start rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface">
              Encore {data.items.length}
            </button>
          )}
          <Link href="/notions?onglet=travailler" className="label link-underline mt-3 inline-flex items-center gap-1 self-start text-text">
            Continuer à s&apos;entraîner <ArrowUpRight className="size-3" aria-hidden />
          </Link>
        </div>
      ) : current ? (
        <div className="flex flex-1 flex-col">
          <Flashcard card={current} size="sm" front={data.front ?? "definition"} flipped={revealed} onFlip={() => setRevealed((r) => !r)} />
          {/* Flèches : passer d'une carte à l'autre sans répondre. */}
          {!revealed && data.items.length > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} aria-label="Carte précédente"
                className="grid size-9 place-items-center rounded-full border border-border text-muted transition-colors hover:border-text hover:text-text disabled:opacity-30">
                <ArrowLeft className="size-4" aria-hidden />
              </button>
              <span className="label text-muted">Touche la carte pour la retourner</span>
              <button type="button" onClick={() => setIndex((i) => Math.min(data.items.length - 1, i + 1))} disabled={index >= data.items.length - 1} aria-label="Carte suivante"
                className="grid size-9 place-items-center rounded-full border border-border text-muted transition-colors hover:border-text hover:text-text disabled:opacity-30">
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          )}
          {revealed && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => answer(false)} className="rounded-full border border-text px-3 py-2 text-[12px] uppercase tracking-[0.04em] transition-colors hover:bg-surface-2">
                À revoir
              </button>
              <button type="button" onClick={() => answer(true)} className="rounded-full bg-text px-3 py-2 text-[12px] font-medium uppercase tracking-[0.04em] text-bg transition-opacity hover:opacity-85">
                Je savais
              </button>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            {index + 1} / {data.items.length}
            {data.totalDue > data.items.length ? ` · ${data.totalDue} à revoir au total` : ""}
            {note ? ` · ${note}` : ""}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center rounded-xl bg-surface-2 p-4 text-sm">
          {data.total === 0 ? (
            <p className="text-muted">Ajoute ta première notion avec le bouton « + » en haut, ou la touche N.</p>
          ) : (
            <>
              <p className="font-medium">Rien à revoir aujourd&apos;hui.</p>
              <p className="mt-1 text-muted">{data.learned} notion(s) apprise(s) sur {data.total}.</p>
              <Link href="/notions?onglet=travailler" className="label link-underline mt-3 inline-flex items-center gap-1 self-start text-text">
                S&apos;entraîner quand même <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            </>
          )}
        </div>
      )}
    </section>
  );
}
