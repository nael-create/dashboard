import { z } from "zod";

export const agendaInputSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(160, "Titre trop long (160 caractères max)."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  allDay: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  location: z.string().max(200).optional(),
  note: z.string().max(3000).optional(),
  repeat: z.enum(["weekly"]).nullable().optional(),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
