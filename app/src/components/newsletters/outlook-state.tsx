import { Mail } from "lucide-react";
import { Empty } from "@/components/ui/card";
import { btnPrimary } from "@/components/ui/forms";
import type { OutlookError } from "@/lib/outlook";

/** État affiché quand la liste ne peut pas être lue (non configuré, non connecté, dossier absent…). */
export function OutlookState({ error, compact = false }: { error: OutlookError; compact?: boolean }) {
  if (error.kind === "not-configured") {
    return (
      <Empty>
        Outlook n&apos;est pas encore configuré.{" "}
        {compact ? "Voir la page Newsletters." : "Suis le guide « Newsletters Outlook » dans app/README.md, puis relance le dashboard."}
      </Empty>
    );
  }
  if (error.kind === "not-connected") {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
        <p className="mb-3 text-sm text-muted">{error.message}</p>
        {/* Lien simple (pas de JavaScript) : redirige vers la connexion Microsoft. */}
        <a href="/api/outlook/login" className={btnPrimary}>
          <Mail className="size-4" aria-hidden /> Se connecter à Outlook
        </a>
      </div>
    );
  }
  return <Empty>{error.message}</Empty>;
}
