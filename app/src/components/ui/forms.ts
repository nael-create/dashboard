/** Classes partagées des champs et boutons (même système de design partout). */
export const field =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent";
export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60";
export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-60";
export const btnDanger =
  "inline-flex items-center justify-center rounded-full bg-rose-600 px-3 py-1 text-sm text-white transition-colors hover:bg-rose-700 disabled:opacity-60";
export const iconBtn =
  "grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text";
export const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 text-sm transition-colors ${
    active ? "border-transparent bg-accent text-white" : "border-border text-muted hover:border-accent hover:text-text"
  }`;
