"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiJson } from "@/lib/client-api";

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
        <Link href="/notions" className="label link-underline inline-flex items-center gap-1 pt-1 text-muted hover:text-text">
          Notions <ArrowUpRight className="size-3" aria-hidden />
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
        </div>
      ) : current ? (
        <div className="flex flex-1 flex-col">
          <button
            type="button"
            onClick={() => setRevealed(true)}
            disabled={revealed}
            aria-expanded={revealed}
            className="flex min-h-48 flex-1 flex-col justify-between bg-surface-2 p-5 text-left transition-colors hover:bg-accent-soft disabled:hover:bg-surface-2 sm:p-6"
          >
            {data.front === "term" ? (
              <>
                <p className="text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-[1.02] tracking-[-0.035em]">{current.term}</p>
                {!revealed ? (
                  <p className="label mt-6 text-muted">Touche pour voir la définition</p>
                ) : (
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{current.definition}</ReactMarkdown></div>
                    {current.example && <p className="italic text-muted">{current.example}</p>}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* La définition d'abord : il faut retrouver le mot. */}
                <div className="md text-[clamp(1.05rem,1.6vw,1.3rem)] font-light leading-snug">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{current.definition}</ReactMarkdown>
                </div>
                {!revealed ? (
                  <p className="label mt-6 text-muted">Quel est le mot ? Touche pour voir la réponse</p>
                ) : (
                  <div className="mt-5 space-y-2">
                    <p className="text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-[1.02] tracking-[-0.035em] text-accent-text">{current.term}</p>
                    {current.example && <p className="text-sm italic text-muted">{current.example}</p>}
                  </div>
                )}
              </>
            )}
          </button>
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
            </>
          )}
        </div>
      )}
    </section>
  );
}
