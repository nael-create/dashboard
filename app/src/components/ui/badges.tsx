import { STATUS_LABELS, type Priority, type Status } from "@/lib/content";
import { daysUntil, formatISODate } from "@/lib/dates";

const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return <span className={`${base} bg-surface-2 text-muted`}>—</span>;
  const style =
    priority === "P1" ? "bg-accent text-white"
    : priority === "P2" ? "bg-accent-soft text-accent-text"
    : "bg-surface-2 text-muted";
  return <span className={`${base} ${style}`}>{priority}</span>;
}

export function StatusBadge({ status }: { status: Status | null }) {
  if (!status) return <span className={`${base} bg-surface-2 text-muted`}>Statut inconnu</span>;
  const style = status === "active" ? "bg-accent-soft text-accent-text" : "bg-surface-2 text-muted";
  return <span className={`${base} ${style}`}>{STATUS_LABELS[status]}</span>;
}

export function DeadlineText({ deadline }: { deadline: string | null }) {
  if (!deadline) return <span className="text-muted">—</span>;
  const d = daysUntil(deadline);
  const urgent = d !== null && d <= 7;
  return (
    <span className={urgent ? "font-medium text-accent-text" : ""} title={d === null ? undefined : d < 0 ? `En retard de ${-d} j` : `Dans ${d} j`}>
      {formatISODate(deadline)}
    </span>
  );
}

/** Affiche « TODO: fill in » de façon discrète mais visible. */
export function Value({ text }: { text: string | null }) {
  if (!text) return <span className="text-muted">—</span>;
  if (text.trim() === "TODO: fill in") return <span className="italic text-muted">TODO: fill in</span>;
  return <>{text}</>;
}
