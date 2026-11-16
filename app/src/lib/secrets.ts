/**
 * Détection de contenus sensibles avant écriture dans un fichier versionné (le dépôt est sur GitHub).
 * Volontairement ciblée sur des signaux forts pour éviter les faux positifs
 * (« changer le mot de passe de la box » est accepté, « mot de passe : abc123 » est refusé).
 */

function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const SECRET_ASSIGNMENT =
  /\b(mot de passe|mots de passe|mdp|password|passwd|pwd|passcode|code pin|pin|digicode|code d['’]acc[eè]s|code secret|code (?:du )?portail|code (?:du )?wi-?fi|cl[eé] wi-?fi|cvv|cvc|cryptogramme)\s*[:=]\s*\S+/i;

/** Renvoie une raison (en français) si le texte ressemble à un secret, sinon null. */
export function detectSensitive(text: string): string | null {
  if (SECRET_ASSIGNMENT.test(text)) return "cela ressemble à un mot de passe ou un code d'accès";
  for (const m of text.matchAll(/(?:\d[ -]?){13,19}/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return "cela ressemble à un numéro de carte bancaire";
  }
  if (/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b/.test(text)) return "cela ressemble à un IBAN";
  if (/\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[a-z])(?=[A-Za-z0-9_-]*[A-Z])[A-Za-z0-9_-]{32,}\b/.test(text)) {
    return "cela ressemble à une clé ou un jeton d'accès";
  }
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) return "cela ressemble à une clé privée";
  return null;
}

/** Motifs de secrets techniques (liens d'abonnement, jetons, clés d'API, liens à clé personnelle). */
export const SECRET_PATTERNS: [RegExp, string][] = [
  [/webcals?:\/\//i, "lien d'abonnement de calendrier (webcal)"],
  [/https?:\/\/\S+\.ics\b/i, "lien d'abonnement de calendrier (.ics)"],
  [/client_secret|refresh_token|access_token|id_token/i, "jeton ou secret d'application"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "clé privée"],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|xox[abp]-[A-Za-z0-9-]{20,}|sk-[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16})\b/, "clé d'API"],
  [/https?:\/\/[^\s)]*[?&](?:token|key|apikey|api_key|secret|sig|signature|auth)=[^\s&)]{8,}/i, "lien contenant une clé personnelle"],
  [/myft\/[a-z0-9-]{20,}/i, "flux myFT personnel"],
];

/**
 * Contrôle d'une ligne destinée à un fichier versionné : motifs techniques, puis contrôle générique
 * (les liens, souvent longs, sont retirés avant ce dernier). Utilisé par « Sauvegarder » et à l'écriture
 * des surlignages. Renvoie une raison en français, ou null.
 */
export function lineSecretReason(line: string): string | null {
  const hit = SECRET_PATTERNS.find(([re]) => re.test(line));
  return hit?.[1] ?? detectSensitive(line.replace(/https?:\/\/\S+/g, ""));
}
