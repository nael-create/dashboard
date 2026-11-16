/**
 * Ancrage des surlignages par citation (« text-quote anchoring ») : le passage surligné, plus un court
 * préfixe et un court suffixe. Pour le retrouver, on cherche le passage dans le texte de la newsletter
 * (espaces normalisés) et, s'il apparaît plusieurs fois, on garde l'occurrence dont le contexte
 * ressemble le plus au préfixe / suffixe enregistrés. Résiste aux petites différences de HTML.
 *
 * Fonctions pures (navigateur et serveur), testées dans test/anchoring.test.ts.
 */

/** Longueur du contexte gardé avant et après le passage. */
export const CONTEXT_LENGTH = 32;
/** Longueur maximale d'un passage surligné. */
export const MAX_PASSAGE = 1000;

export interface Quote {
  exact: string;
  prefix: string;
  suffix: string;
}

/** Espaces (y compris insécables et retours à la ligne) réduits à un seul espace. */
export const collapse = (s: string) => s.replace(/[\s  ]+/g, " ");

/** Citation à partir de positions dans le texte ; les espaces aux bords du passage sont retirés. */
export function quoteFrom(text: string, start: number, end: number): Quote | null {
  while (start < end && /[\s  ]/.test(text[start])) start++;
  while (end > start && /[\s  ]/.test(text[end - 1])) end--;
  if (end <= start) return null;
  return {
    exact: collapse(text.slice(start, end)),
    prefix: collapse(text.slice(Math.max(0, start - CONTEXT_LENGTH * 2), start)).trim().slice(-CONTEXT_LENGTH).trim(),
    suffix: collapse(text.slice(end, end + CONTEXT_LENGTH * 2)).trim().slice(0, CONTEXT_LENGTH).trim(),
  };
}

/** Texte aux espaces normalisés, avec la position d'origine de chaque caractère. */
function normalizeWithMap(text: string): { s: string; map: number[] } {
  let s = "";
  const map: number[] = [];
  let inSpace = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/[\s  ]/.test(c)) {
      if (!inSpace) {
        s += " ";
        map.push(i);
      }
      inSpace = true;
    } else {
      s += c;
      map.push(i);
      inSpace = false;
    }
  }
  return { s, map };
}

const commonSuffix = (a: string, b: string) => {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
};
const commonPrefix = (a: string, b: string) => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
};

/** Retrouve le passage dans le texte : positions [start, end) dans le texte d'origine, ou null. */
export function locateQuote(text: string, quote: Quote): { start: number; end: number } | null {
  const exact = collapse(quote.exact).trim();
  if (!exact) return null;
  const { s, map } = normalizeWithMap(text);
  const hits: number[] = [];
  for (let i = s.indexOf(exact); i !== -1; i = s.indexOf(exact, i + 1)) hits.push(i);
  if (!hits.length) return null;
  const pre = collapse(quote.prefix).trim();
  const suf = collapse(quote.suffix).trim();
  let best = hits[0];
  let bestScore = -1;
  for (const i of hits) {
    const before = s.slice(Math.max(0, i - pre.length - 4), i).trimEnd();
    const after = s.slice(i + exact.length, i + exact.length + suf.length + 4).trimStart();
    const score = commonSuffix(before, pre) + commonPrefix(after, suf);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return { start: map[best], end: map[best + exact.length - 1] + 1 };
}
