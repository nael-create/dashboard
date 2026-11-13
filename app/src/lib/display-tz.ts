import config from "@config";

/**
 * Fuseau d'affichage : celui forcé dans dashboard.config.ts, sinon celui de l'ordinateur.
 * Côté serveur comme côté navigateur, l'app tourne sur ton ordinateur : les deux coïncident.
 */
export function displayTimeZone(): string {
  if (config.timeZone) return config.timeZone;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
