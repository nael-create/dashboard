import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { EmailFrame } from "@/components/newsletters/email-frame";
import type { EmailView } from "@/lib/email-document";
import type { Newsletter } from "@/lib/outlook";
import { formatDateTime } from "@/lib/relative-time";
import { StarButton } from "@/components/favorites/favorites-context";

const toggle = "label inline-flex items-center gap-1.5 py-1 transition-colors";

/** Lecture d'une newsletter : en-tête éditorial, réglages (lecture / original, images), contenu isolé. */
export function NewsletterView({ msg, id, images, view }: { msg: Newsletter; id: string; images: boolean; view: EmailView }) {
  const self = `/newsletters/${encodeURIComponent(id)}`;
  const href = (v: EmailView, img: boolean) => {
    const q = new URLSearchParams();
    if (v === "original") q.set("vue", "original");
    if (img) q.set("images", "1");
    const s = q.toString();
    return s ? `${self}?${s}` : self;
  };
  const choice = (active: boolean) => `${toggle} ${active ? "text-text" : "text-muted hover:text-text"}`;
  const dot = (active: boolean) => <span className={`size-1.5 rounded-full ${active ? "bg-accent" : "bg-transparent"}`} aria-hidden />;

  return (
    <article className="rise">
      <Link href="/newsletters" className="label mb-8 inline-flex items-center gap-1.5 text-muted transition-colors hover:text-text">
        <ArrowLeft className="size-3.5" aria-hidden /> Newsletters
      </Link>
      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-12">
          {/* En-tête : expéditeur, date, titre, réglages de lecture. */}
          <header className="lg:col-span-12">
            <p className="label text-muted">
              {msg.from}
              <span aria-hidden> · </span>
              <time dateTime={msg.received}>{formatDateTime(msg.received)}</time>
            </p>
            <h1 className="mt-3 max-w-[22ch] text-[clamp(2.25rem,6vw,5rem)] font-light leading-[0.98] tracking-[-0.04em] text-balance">
              {msg.subject}
            </h1>
            {msg.fromAddress && msg.fromAddress !== msg.from && <p className="mt-3 text-sm text-muted">{msg.fromAddress}</p>}
          </header>

          <aside className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3 lg:col-span-3 lg:sticky lg:top-28 lg:flex-col lg:items-start lg:self-start lg:border-y-0 lg:border-t lg:py-4">
            <nav aria-label="Affichage" className="flex items-center gap-4">
              <Link href={href("lecture", images)} aria-current={view === "lecture" ? "true" : undefined} className={choice(view === "lecture")}>
                {dot(view === "lecture")} Lecture
              </Link>
              <Link href={href("original", images)} aria-current={view === "original" ? "true" : undefined} className={choice(view === "original")}>
                {dot(view === "original")} Original
              </Link>
            </nav>
            <nav aria-label="Images" className="flex items-center gap-4">
              <Link href={href(view, false)} aria-current={!images ? "true" : undefined} className={choice(!images)}>
                {dot(!images)} Sans images
              </Link>
              <Link href={href(view, true)} aria-current={images ? "true" : undefined} className={choice(images)}>
                {dot(images)} Images
              </Link>
            </nav>
            <div className="flex items-center gap-3 lg:mt-2">
              {msg.webLink && <StarButton type="newsletter" refId={msg.webLink} title={msg.subject} source={msg.from} published={msg.received.slice(0, 10)} />}
              {msg.webLink && (
                <a href={msg.webLink} target="_blank" rel="noopener noreferrer" className={`${toggle} text-muted hover:text-text`}>
                  <ExternalLink className="size-3.5" aria-hidden /> Outlook
                </a>
              )}
            </div>
            {!images && <p className="hidden max-w-[24ch] text-xs leading-relaxed text-muted lg:block">Images distantes bloquées : elles servent souvent à pister la lecture.</p>}
          </aside>

          <div className={`min-w-0 lg:col-span-9 ${view === "original" ? "border border-border" : ""}`}>
            {/* Cadre isolé : aucun script, aucun accès aux données de l'app, chargements externes bloqués par CSP. */}
            <EmailFrame html={msg.html} images={images} view={view} title="Contenu de la newsletter" />
          </div>
      </div>
    </article>
  );
}
