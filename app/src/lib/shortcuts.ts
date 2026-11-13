"use client";

/** Événements globaux de l'app (raccourcis clavier, palette, ajout rapide). */
export const EVENTS = {
  newNotion: "dashboard:new-notion",
  contentChanged: "content-changed",
} as const;

/** Vrai si l'utilisateur est en train d'écrire (les raccourcis à une touche sont alors ignorés). */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable || !!el.closest?.("[contenteditable=true]");
}
