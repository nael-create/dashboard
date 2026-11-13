"use client";

import { ArrowRight, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiJson } from "@/lib/client-api";

interface DueNotion { id: string; term: string; definition: string; example: string; tags: string[]; box: number }
interface DuePayload { items: DueNotion[]; totalDue: number; learned: number; total: number }

/**
 * « À retenir aujourd'hui » : révision passive, jamais obligatoire.
 * Le terme d'abord ; un clic révèle la définition ; « Je savais » / « À revoir ».
 * Une notion ignorée reste simplement à revoir.
 */
export function NotionsToday() {
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
    <section className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <GraduationCap className="size-4 text-accent-text" aria-hidden /> À retenir aujourd&apos;hui
        </h2>
        <Link href="/notions" className="group inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-accent-text">
          Notions <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
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
            className="flex-1 rounded-xl bg-surface-2 p-4 text-left transition-colors hover:bg-accent-soft disabled:hover:bg-surface-2"
          >
            <p className="text-lg font-semibold leading-snug">{current.term}</p>
            {!revealed ? (
              <p className="mt-2 text-sm text-muted">Touche pour voir la définition</p>
            ) : (
              <div className="mt-2 space-y-2 text-sm">
                <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{current.definition}</ReactMarkdown></div>
                {current.example && <p className="italic text-muted">{current.example}</p>}
              </div>
            )}
          </button>
          {revealed && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => answer(false)} className="rounded-full border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-2">
                À revoir
              </button>
              <button type="button" onClick={() => answer(true)} className="rounded-full bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
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
