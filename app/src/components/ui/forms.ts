/** Classes partagées des champs et boutons (système de design éditorial). */
export const field =
  "w-full border border-border bg-surface px-3 py-2 text-[15px] outline-none transition-colors placeholder:text-muted/80 focus:border-text";
export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-text px-4 py-2 text-[12px] font-medium uppercase tracking-[0.04em] text-bg transition-opacity hover:opacity-85 disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] uppercase tracking-[0.04em] text-muted transition-colors hover:text-text disabled:opacity-50";
export const btnDanger =
  "inline-flex items-center justify-center rounded-full bg-rose-700 px-3 py-1.5 text-[12px] uppercase tracking-[0.04em] text-white transition-colors hover:bg-rose-800 disabled:opacity-60";
export const iconBtn =
  "grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text";
export const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 text-[12px] uppercase tracking-[0.04em] transition-colors ${
    active ? "border-text bg-text text-bg" : "border-border text-muted hover:border-text hover:text-text"
  }`;
