/**
 * « À la une » (accueil) : choix et mise en page des sujets. Fonctions pures, testées dans
 * test/headlines.test.ts.
 *
 * - Seuls les articles AVEC image sont retenus (image du flux, sinon og:image).
 * - Colonne vertébrale : l'ordre éditorial du flux principal (FT International) ; les autres sources
 *   s'intercalent à tour de rôle ; jamais plus de 2 sujets d'affilée de la même source.
 * - Mise en page adaptée au nombre de sujets (aucun trou), première rangée dominante.
 */

export const MAX_RUN = 2;

/**
 * Entrelace la source principale et les autres : principale tant qu'elle n'a pas déjà fourni les
 * `maxRun` derniers sujets, sinon la source suivante (tour de rôle). S'arrête plutôt que d'enchaîner
 * plus de `maxRun` sujets d'une même source.
 */
export function interleave<T extends { sourceId: string }>(backbone: T[], others: T[][], max: number, maxRun = MAX_RUN): T[] {
  const main = [...backbone];
  const queues = others.map((q) => [...q]).filter((q) => q.length);
  const out: T[] = [];
  let turn = 0;
  const runOf = (sourceId: string) => {
    let n = 0;
    for (let i = out.length - 1; i >= 0 && out[i].sourceId === sourceId; i--) n++;
    return n;
  };
  while (out.length < max) {
    if (main.length && runOf(main[0].sourceId) < maxRun) {
      out.push(main.shift()!);
      continue;
    }
    // Une autre source, à tour de rôle, sans dépasser la limite d'affilée.
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
  span: "lg:col-span-12" | "lg:col-span-6" | "lg:col-span-4" | "lg:col-span-3";
  /** Première rangée : grande image (hauteur plafonnée). */
  big: boolean;
}

const SPAN: Record<number, Cell["span"]> = { 1: "lg:col-span-12", 2: "lg:col-span-6", 3: "lg:col-span-4", 4: "lg:col-span-3" };

/**
 * Mise en page sans trou : 1 sujet = pleine largeur ; 2 = deux moitiés ; 3 = trois tiers ;
 * 4 et plus = deux grands sujets côte à côte, puis des rangées de 4 au plus, réparties à parts égales
 * (ex. 5 restants → 3 + 2, 6 → 3 + 3, 7 → 4 + 3).
 */
export function gridLayout(n: number): Cell[] {
  if (n <= 0) return [];
  if (n <= 3) return Array.from({ length: n }, () => ({ span: SPAN[n], big: n <= 2 }));
  const cells: Cell[] = [{ span: SPAN[2], big: true }, { span: SPAN[2], big: true }];
  const rest = n - 2;
  const rows = Math.ceil(rest / 4);
  for (let r = 0; r < rows; r++) {
    const size = Math.floor(rest / rows) + (r < rest % rows ? 1 : 0);
    for (let i = 0; i < size; i++) cells.push({ span: SPAN[size], big: false });
  }
  return cells;
}
