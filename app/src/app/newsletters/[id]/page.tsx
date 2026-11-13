import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ImageIcon, ImageOff } from "lucide-react";
import { btnGhost } from "@/components/ui/forms";
import { OutlookState } from "@/components/newsletters/outlook-state";
import { emailDocument, getNewsletter, OutlookError, type Newsletter } from "@/lib/outlook";
import { formatDateTime } from "@/lib/relative-time";
import { StarButton } from "@/components/favorites/favorites-context";

export const metadata: Metadata = { title: "Newsletter" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NewsletterPage({ params, searchParams }: Props) {
  const id = decodeURIComponent((await params).id);
  const images = (await searchParams).images === "1";
  let msg: Newsletter | null = null;
  let error: OutlookError | null = null;
  try {
    msg = await getNewsletter(id);
  } catch (e) {
    error = e instanceof OutlookError ? e : new OutlookError("Impossible d'ouvrir ce message.");
  }
  const self = `/newsletters/${encodeURIComponent(id)}`;

  return (
    <article>
      <Link href="/newsletters" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent-text">
        <ArrowLeft className="size-4" aria-hidden /> Newsletters
      </Link>
      {error || !msg ? (
        <OutlookState error={error ?? new OutlookError("Message introuvable.")} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5 sm:p-6">
            <div className="min-w-0">
              <h1 className="text-[clamp(1.75rem,3.5vw,3rem)] font-light leading-[1.05] tracking-[-0.035em]">{msg.subject}</h1>
              <p className="mt-1 text-sm text-muted">
                {msg.from}{msg.fromAddress && msg.fromAddress !== msg.from ? ` <${msg.fromAddress}>` : ""} · {formatDateTime(msg.received)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {msg.webLink && <StarButton type="newsletter" refId={msg.webLink} title={msg.subject} source={msg.from} published={msg.received.slice(0, 10)} />}
              {images ? (
                <Link href={self} className={btnGhost}><ImageOff className="size-4" aria-hidden /> Bloquer les images</Link>
              ) : (
                <Link href={`${self}?images=1`} className={btnGhost}><ImageIcon className="size-4" aria-hidden /> Charger les images</Link>
              )}
              {msg.webLink && (
                <a href={msg.webLink} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                  <ExternalLink className="size-4" aria-hidden /> Ouvrir dans Outlook
                </a>
              )}
            </div>
          </header>
          {!images && (
            <p className="border-b border-border bg-surface-2 px-5 py-2 text-xs text-muted">
              Images distantes bloquées (elles servent souvent à pister la lecture).
            </p>
          )}
          {/* Cadre isolé : aucun script, aucun accès à l'app, chargements externes bloqués par CSP. */}
          <iframe
            title={`Contenu : ${msg.subject}`}
            srcDoc={emailDocument(msg.html, images)}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            className="h-[75dvh] w-full bg-white"
          />
        </div>
      )}
    </article>
  );
}
