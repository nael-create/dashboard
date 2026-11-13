/**
 * Entraînement façon Quizlet (onglet « Travailler » des notions) : fonctions pures, testées.
 * Le mot est « derrière » : on montre la définition, il faut retrouver le mot.
 */
import { fold } from "./slug";

export interface PracticeCard {
  id: string;
  term: string;
  definition: string;
  example: string;
  box: number;
  due: string | null;
}

/** Forme comparable d'une réponse : sans accents, casse, ponctuation ni espaces superflus. */
export function normalizeAnswer(s: string): string {
  return fold(s)
    .toLowerCase()
    .replace(/[’'`´]/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Réponses acceptées : le terme entier, ou chacune de ses variantes séparées par « , », « / » ou « ; ». */
export function acceptedAnswers(term: string): string[] {
  const parts = term.split(/[,/;]/).map(normalizeAnswer).filter(Boolean);
  return [...new Set([normalizeAnswer(term), ...parts])];
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/**
 * Mode « Écrire » : « correct » (identique, accents et majuscules ignorés), « close » (une faute de
 * frappe sur un mot d'au moins 6 lettres, compté juste) ou « wrong ».
 */
export function checkWritten(term: string, input: string): "correct" | "close" | "wrong" {
  const given = normalizeAnswer(input);
  if (!given) return "wrong";
  const accepted = acceptedAnswers(term);
  if (accepted.includes(given)) return "correct";
  if (accepted.some((a) => a.length >= 6 && levenshtein(a, given) <= 1)) return "close";
  return "wrong";
}

/** Mélange (Fisher-Yates) ; `rand` injectable pour les tests. */
export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Mode « QCM » : la bonne réponse et jusqu'à 3 autres mots, dans le désordre. */
export function choicesFor(card: PracticeCard, pool: PracticeCard[], rand: () => number = Math.random): string[] {
  const others = shuffle(
    pool.filter((c) => c.id !== card.id && normalizeAnswer(c.term) !== normalizeAnswer(card.term)).map((c) => c.term),
    rand,
  ).slice(0, 3);
  return shuffle([card.term, ...others], rand);
}

export type DeckKind = "due" | "learning" | "all";

/** Paquet de cartes : à revoir aujourd'hui, pas encore apprises (boîte < learnedBox) ou toutes. */
export function buildDeck(cards: PracticeCard[], kind: DeckKind, today: string, learnedBox: number): PracticeCard[] {
  if (kind === "due") return cards.filter((c) => c.due !== null && c.due <= today);
  if (kind === "learning") return cards.filter((c) => c.box < learnedBox);
  return cards;
}

/**
 * Ce qui est enregistré dans la mémoire (progression Leitner) :
 * - « À revoir » : toujours (la carte revient demain) ;
 * - « Je savais » : seulement si la carte était à revoir aujourd'hui (pas d'avance gratuite).
 */
export function shouldRecord(knew: boolean, card: PracticeCard, today: string): boolean {
  if (!knew) return true;
  return card.due !== null && card.due <= today;
}
