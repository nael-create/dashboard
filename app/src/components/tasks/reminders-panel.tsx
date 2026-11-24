"use client";

import { Mail, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/client-api";
import type { RemindersStatus } from "@/lib/gh";
import type { TaskSyncStatus } from "@/lib/task-sync";
import type { TaskSettings } from "@/lib/tasks-core";
import { btnGhost, field } from "@/components/ui/forms";
import type { TasksApi } from "./use-tasks";

function ago(iso: string | null, now: number): string {
  if (!iso) return "";
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
}

/**
 * Panneau « rappels par e-mail » (onglet aujourd'hui) : activer, heures des récapitulatifs, matin,
 * synchro automatique de TACHES.md, mail de test, état du dernier passage du workflow GitHub.
 * Les réglages sont écrits dans le frontmatter de TACHES.md (jamais l'adresse ni la clé).
 */
export function RemindersPanel({ api }: { api: TasksApi }) {
  const settings = api.state?.settings;
  const [status, setStatus] = useState<(RemindersStatus & { sync: TaskSyncStatus }) | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (force = false) => {
    try {
      setStatus(await apiJson(`/api/tasks/reminders${force ? "?rafraichir=1" : ""}`));
    } catch {
      /* état facultatif */
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => {
      setNow(Date.now());
      load();
    }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (!settings) return null;
  const set = (patch: Partial<TaskSettings>) => api.run({ action: "settings", settings: patch }).then(() => load());
  const sync = status?.sync ?? api.state?.sync;

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await apiJson("/api/tasks/reminders", "POST", { action: "test" });
      setMsg({ ok: true, text: "Demandé à GitHub : le mail de test arrive d'ici 1 à 2 minutes." });
      setTimeout(() => load(true), 45_000);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const syncNow = async () => {
    setBusy(true);
    try {
      await apiJson("/api/tasks/reminders", "POST", { action: "sync" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const run = status?.lastRun;
  const runLabel = !run ? null
    : run.status !== "completed" ? "en cours"
    : run.conclusion === "success" ? "réussi" : `échec (${run.conclusion ?? "inconnu"})`;

  return (
    <details className="group border-t border-text/80 pt-4">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-3">
          <Mail className="size-4 self-center text-muted" aria-hidden />
          <span className="title-md lowercase">rappels par e-mail</span>
          <span className="label text-muted">{settings.reminders ? "activés" : "désactivés"}</span>
        </span>
        <span className="label text-muted transition-transform group-open:rotate-90">›</span>
      </summary>

      <div className="mt-5 grid gap-5 text-sm">
        <Toggle label="Rappels activés" checked={settings.reminders} onChange={(v) => set({ reminders: v })} />
        <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="label text-muted">récapitulatif du soir</span>
            <input type="time" value={settings.eveningDigest} onChange={(e) => e.target.value && set({ eveningDigest: e.target.value })} className={`${field} max-w-[11rem]`} disabled={!settings.reminders} />
          </label>
          <div className="grid gap-1">
            <span className="label text-muted">récapitulatif du matin</span>
            <div className="flex flex-wrap items-center gap-3">
              <input type="time" value={settings.morningDigest} onChange={(e) => e.target.value && set({ morningDigest: e.target.value })} className={`${field} max-w-[11rem]`} disabled={!settings.reminders || !settings.morningEnabled} aria-label="Heure du récapitulatif du matin" />
              <Toggle label="Activé" checked={settings.morningEnabled} onChange={(v) => set({ morningEnabled: v })} disabled={!settings.reminders} />
            </div>
          </div>
        </div>
        <p className="text-[12px] leading-relaxed text-muted">
          Fuseau : {settings.timezone}. GitHub vérifie toutes les heures (à la minute 7) : un rappel part au premier passage
          après son heure, donc jusqu&apos;à une heure plus tard. Au plus 3 mails par jour, aucun s&apos;il n&apos;y a rien à dire.
          Rappel d&apos;une tâche : ajoute « ⏰ » (à l&apos;heure) ou « ⏰-30m » dans la saisie, ou choisis-le dans « Modifier ».
          Les titres des tâches passent par le service d&apos;envoi (Resend).
        </p>

        <div className="grid gap-2 border-t border-border pt-4">
          <Toggle label="Synchronisation automatique de TACHES.md" checked={settings.autosync} onChange={(v) => set({ autosync: v })} />
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            {!settings.autosync ? (
              <span>Désactivée : les rappels utilisent la dernière version envoyée avec « Sauvegarder ».</span>
            ) : sync?.lastSync ? (
              <span>synchronisé {ago(sync.lastSync, now)}</span>
            ) : sync?.pending ? (
              <span>envoi dans moins d&apos;une minute…</span>
            ) : (
              <span>pas encore synchronisé depuis le démarrage</span>
            )}
            {settings.autosync && sync?.pending && sync.lastSync && <span>· modification en attente</span>}
            {settings.autosync && (
              <button type="button" onClick={syncNow} disabled={busy} className="label link-underline inline-flex items-center gap-1 hover:text-text">
                <RefreshCw className="size-3" aria-hidden /> synchroniser maintenant
              </button>
            )}
          </p>
          {settings.autosync && sync?.error && <p className="text-[12px] text-amber-800 dark:text-amber-300">{sync.error} Nouvel essai automatique dans quelques minutes.</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button type="button" onClick={test} disabled={busy} className={`${btnGhost} border border-border`}>Envoyer un mail de test</button>
          <span className="text-[12px] text-muted">
            {status?.error ? status.error
              : run ? <>Dernier passage : <a href={run.url} target="_blank" rel="noopener noreferrer" className="link-underline">{runLabel}, {ago(run.createdAt, now)}</a>
                {status?.lastSuccess && status.lastSuccess !== run && run.conclusion !== "success" && <> · dernier réussi {ago(status.lastSuccess.createdAt, now)}</>}</>
              : status ? "Aucun passage pour l'instant." : ""}
          </span>
        </div>
        {run && run.status === "completed" && run.conclusion !== "success" && (
          <p className="text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">
            Le dernier passage a échoué. Le plus souvent : les secrets <code>RESEND_API_KEY</code> et <code>REMINDER_TO</code> ne sont pas
            encore dans GitHub (dépôt → Settings → Secrets and variables → Actions), ou <code>REMINDER_TO</code> n&apos;est pas l&apos;adresse
            du compte Resend. Le détail est dans le lien ci-dessus. Guide : app/README.md, « Rappels par e-mail ».
          </p>
        )}
        {msg && <p role="status" className={`text-[13px] ${msg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>{msg.text}</p>}
      </div>
    </details>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2.5 ${disabled ? "opacity-50" : ""}`}>
      <button
        type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-border"}`}
      >
        <span className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
      <span>{label}</span>
    </label>
  );
}
