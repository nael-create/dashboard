/**
 * « À la une » (accueil) : choix et mise en page des sujets. Fonctions pures, testées dans
 * test/headlines.test.ts.
 *
 * - Seuls les articles AVEC image sont retenus (image du flux, sinon og:image).
 * - Sources équilibrées (demande du propriétaire) : chaque source active (une par site) fournit un sujet
 *   à tour de rôle — FT International d'abord, puis les autres —, chacune dans son ordre éditorial ;
 *   une source épuisée laisse sa place aux autres ; jamais plus de 2 sujets d'affilée de la même source.
 * - Mise en page adaptée au nombre de sujets (aucun trou), rangées de 6.
 */

export const MAX_RUN = 2;

/**
 * Tour de rôle équilibré : `first` (FT International) puis chacune des `others`, un sujet chacune, et on
 * recommence. Une source vide est sautée. S'arrête plutôt que d'enchaîner plus de `maxRun` sujets
 * d'une même source (quand il ne reste qu'elle).
 */
export function interleave<T extends { sourceId: string }>(first: T[], others: T[][], max: number, maxRun = MAX_RUN): T[] {
  const queues = [first, ...others].map((q) => [...q]).filter((q) => q.length);
  const out: T[] = [];
  const runOf = (sourceId: string) => {
    let n = 0;
    for (let i = out.length - 1; i >= 0 && out[i].sourceId === sourceId; i--) n++;
    return n;
  };
  let turn = 0;
  while (out.length < max) {
    let picked = false;
    for (let k = 0; k < queues.length; k++) {
      const q = queues[(turn + k) % queues.length];
      if (q.length && runOf(q[0].sourceId) < maxRun) {
        out.push(q.shift()!);
        turn = (turn + k + 1) % queues.length;
        picked = true;
        break;
      }
    }
    if (!picked) break;
  }
  return out;
}

export interface Cell {
  /** Classe de largeur sur grand écran (12 colonnes). */
  span: "lg:col-span-12" | "lg:col-span-6" | "lg:col-span-4" | "lg:col-span-3" | "lg:col-span-2";
  /** Première rangée : grande image (hauteur plafonnée). */
  big: boolean;
}

const SPAN: Record<number, Cell["span"]> = { 1: "lg:col-span-12", 2: "lg:col-span-6", 3: "lg:col-span-4", 4: "lg:col-span-3", 6: "lg:col-span-2" };
/** Sujets par rangée sous les deux grands (6 = petites images, réglage du propriétaire). */
export const ROW_SIZE = 6;

/**
 * Mise en page sans trou : 1 sujet = pleine largeur ; 2 = deux moitiés ; 3 = trois tiers ;
 * 4 et plus = rangées de 6 petites images (ROW_SIZE, réglage du propriétaire), la dernière rangée
 * incomplète répartie sans trou (5 → 3 + 2 ; 8 → 6 + 2 ; 12 → 6 + 6). Largeurs possibles par rangée :
 * 1, 2, 3, 4 ou 6 sujets (12 colonnes).
 */
export function gridLayout(n: number): Cell[] {
  if (n <= 0) return [];
  if (n <= 3) return Array.from({ length: n }, () => ({ span: SPAN[n], big: n <= 2 }));
  const cells: Cell[] = [];
  let rest = n;
  while (rest > 0) {
    const size = rest >= ROW_SIZE ? ROW_SIZE : rest === 5 ? 3 : rest;
    for (let i = 0; i < size; i++) cells.push({ span: SPAN[size], big: false });
    rest -= size;
  }
  return cells;
}
