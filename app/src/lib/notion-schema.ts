import { z } from "zod";

export const notionFields = {
  term: z.string().trim().min(1, "Le terme est obligatoire.").max(120, "Terme trop long (120 caractères max)."),
  definition: z.string().max(5000, "Définition trop longue."),
  example: z.string().max(3000, "Exemple trop long."),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
};
