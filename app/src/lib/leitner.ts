/** Répétition espacée (Leitner) : constantes partagées par le serveur et le navigateur. */

/** Intervalles (jours) pour les boîtes 1 à 6. */
export const INTERVALS = [1, 2, 5, 14, 30, 90];
/** « Apprise » à partir de cette boîte. */
export const LEARNED_BOX = 4;

/** Boîte et délai (jours) après une réponse : « Je savais » → boîte suivante ; « À revoir » → boîte 1, demain. */
export function afterAnswer(box: number, knew: boolean): { box: number; days: number } {
  const next = knew ? Math.min(box + 1, INTERVALS.length) : 1;
  return { box: next, days: knew ? INTERVALS[next - 1] : 1 };
}
