import { fold } from "./slug";

/**
 * Score de correspondance approximative (plus haut = meilleur), ou null si aucune correspondance.
 * Insensible aux accents et à la casse. Ordre de préférence : texte contenu tel quel (bonus en début
 * de mot), puis tous les mots présents, puis lettres dans l'ordre et rapprochées (« tx dir » → « taux directeur »).
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = fold(query).trim().replace(/\s+/g, " ");
  if (!q) return 0;
  const t = fold(text);
  const boundary = (i: number) => i === 0 || /[^a-z0-9]/.test(t[i - 1]);

  const idx = t.indexOf(q);
  if (idx >= 0) return 1000 + (boundary(idx) ? 200 : 0) - idx - t.length * 0.05;

  const words = q.split(" ");
  if (words.length > 1 && words.every((w) => t.includes(w))) return 600 - t.length * 0.05;

  // Lettres dans l'ordre, sans trop d'écart.
  const letters = q.replace(/ /g, "");
  let pos = -1;
  let first = -1;
  let score = 0;
  for (const ch of letters) {
    const found = t.indexOf(ch, pos + 1);
    if (found < 0) return null;
    if (first < 0) first = found;
    score += found === pos + 1 ? 6 : 1;
    if (boundary(found)) score += 4;
    pos = found;
  }
  if (pos - first > letters.length * 4) return null;
  return 100 + score - (pos - first) * 0.5;
}

/** Filtre et trie une liste par pertinence. */
export function fuzzyFilter<T>(query: string, items: T[], text: (item: T) => string, limit = Infinity): T[] {
  if (!query.trim()) return items.slice(0, limit);
  return items
    .map((item) => ({ item, s: fuzzyScore(query, text(item)) }))
    .filter((x): x is { item: T; s: number } => x.s !== null)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.item);
}
