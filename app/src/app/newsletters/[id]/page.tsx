import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OutlookState } from "@/components/newsletters/outlook-state";
import { NewsletterView } from "@/components/newsletters/newsletter-view";
import type { EmailView } from "@/lib/email-document";
import { redirect } from "next/navigation";
import { getNewsletter, OutlookError, type Newsletter } from "@/lib/outlook";
import { readHighlights, sameNewsletter } from "@/lib/highlights";

export const metadata: Metadata = { title: "Newsletter" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NewsletterPage({ params, searchParams }: Props) {
  const id = decodeURIComponent((await params).id);
  const sp = await searchParams;
  const images = sp.images === "1";
  const view: EmailView = sp.vue === "original" ? "original" : "lecture";
  let msg: Newsletter | null = null;
  let error: OutlookError | null = null;
  try {
    msg = await getNewsletter(id, { images });
  } catch (e) {
    error = e instanceof OutlookError ? e : new OutlookError("Impossible d'ouvrir ce message.");
  }
  const focus = typeof sp.surlignage === "string" && /^hl-\d{8}-\d+$/.test(sp.surlignage) ? sp.surlignage : undefined;
  const { highlights, version } = await readHighlights();
  if (error || !msg) {
    // Ouvert depuis « Surlignages » mais la newsletter n'est plus disponible : lien Outlook web.
    const link = focus ? highlights.find((h) => h.id === focus)?.link : undefined;
    if (error?.kind === "not-found" && link) redirect(link);
    return (
      <article>
        <Link href="/newsletters" className="label mb-8 inline-flex items-center gap-1.5 text-muted transition-colors hover:text-text">
          <ArrowLeft className="size-3.5" aria-hidden /> Newsletters
        </Link>
        <OutlookState error={error ?? new OutlookError("Message introuvable.")} />
      </article>
    );
  }
  const mine = highlights
    .filter((h) => sameNewsletter(h, msg))
    .map(({ id: hid, color, text, prefix, suffix, note }) => ({ id: hid, color, text, prefix, suffix, note }));
  return <NewsletterView msg={msg} id={id} images={images} view={view} highlights={mine} version={version} focus={focus} />;
}
