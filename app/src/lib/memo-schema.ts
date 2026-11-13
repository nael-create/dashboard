import { z } from "zod";

/** Validation des champs d'une entrée de mémo (partagée par les routes d'API). */
export const memoFields = {
  title: z.string().trim().min(1, "Donne un titre court.").max(120, "Titre trop long (120 caractères max)."),
  text: z.string().max(10_000, "Texte trop long."),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  pinned: z.boolean(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
};
