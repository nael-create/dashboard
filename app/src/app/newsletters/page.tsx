import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { btnGhost } from "@/components/ui/forms";
import { OutlookState } from "@/components/newsletters/outlook-state";
import { connectedAccount, folderName, listNewsletters, OutlookError, type NewsletterSummary } from "@/lib/outlook";
import { relativeTime } from "@/lib/relative-time";

export const metadata: Metadata = { title: "Newsletters" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function NewslettersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const loginError = typeof sp.erreur === "string" ? sp.erreur : null;

  let items: NewsletterSummary[] = [];
  let error: OutlookError | null = null;
  let account: string | null = null;
  try {
    account = await connectedAccount();
    items = await listNewsletters();
  } catch (e) {
    error = e instanceof OutlookError ? e : new OutlookError("Impossible de lire les newsletters pour le moment.");
  }

  return (
    <>
      <PageHeader
        title="Newsletters"
        subtitle={`Le dossier « ${folderName()} » de ta boîte Outlook, en lecture seule.${account ? ` Connecté : ${account}.` : ""}`}
      >
        {account && (
          <div className="flex gap-1">
            <form action="/api/outlook/refresh" method="post">
              <button type="submit" className={btnGhost}><RefreshCw className="size-4" aria-hidden /> Rafraîchir</button>
            </form>
            <form action="/api/outlook/logout" method="post">
              <button type="submit" className={btnGhost}><LogOut className="size-4" aria-hidden /> Se déconnecter</button>
            </form>
          </div>
        )}
      </PageHeader>

      {loginError && <div className="mb-4"><Notice>{loginError}</Notice></div>}

      {error ? (
        <OutlookState error={error} />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          Le dossier « {folderName()} » est vide.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {items.map((m) => (
            <li key={m.id}>
              <Link href={`/newsletters/${encodeURIComponent(m.id)}`} className="flex gap-4 px-4 py-4 transition-colors hover:bg-surface-2 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={`truncate text-sm ${m.isRead ? "text-muted" : "font-semibold"}`}>{m.from}</p>
                    <time dateTime={m.received} className="shrink-0 text-xs text-muted">{relativeTime(m.received)}</time>
                  </div>
                  <p className={`truncate ${m.isRead ? "" : "font-semibold"}`}>{m.subject}</p>
                  <p className="line-clamp-2 text-sm text-muted">{m.preview}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
