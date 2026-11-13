import { z } from "zod";

export const sourceFields = {
  name: z.string().trim().min(1, "Donne un nom à la source.").max(60, "Nom trop long (60 caractères max).").refine((s) => !/[\r\n]/.test(s)),
  category: z.string().trim().min(1, "Choisis une catégorie.").max(40, "Catégorie trop longue.").refine((s) => !/[\r\n]/.test(s)),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
};

/** Un lien qui ressemble à une clé personnelle ne doit jamais aller dans NEWS.md (publié sur GitHub). */
export function looksPersonal(url: string): boolean {
  try {
    const u = new URL(url);
    if (/myft|personal|private/i.test(u.pathname)) return true;
    for (const [k, v] of u.searchParams) {
      if (/token|key|secret|sig|auth|session|uid|user/i.test(k) && v.length >= 8) return true;
    }
    return /[A-Za-z0-9_-]{32,}/.test(u.pathname);
  } catch {
    return false;
  }
}
