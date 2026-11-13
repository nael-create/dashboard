import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin, UserError } from "@/lib/api";
import { todayISO } from "@/lib/dates";
import { editEntry, readEditable } from "@/lib/entries-edit";
import { markInboxDone, readInbox, removeInboxItem } from "@/lib/inbox";
import { addMemo, readMemo } from "@/lib/memo";
import { addNotion } from "@/lib/notions";

export const dynamic = "force-dynamic";

const schema = z.object({
  index: z.number().int().min(0),
  raw: z.string(),
  action: z.enum(["project", "notion", "memo", "delete", "keep"]),
  project: z.string().optional(),
});

/** Traite un élément de l'inbox ; les éléments routés sont cochés « - [x] », « Supprimer » retire la ligne. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Données invalides.");
  const { index, raw, action, project } = parsed.data;
  try {
    const item = (await readInbox()).items[index];
    if (!item || item.raw !== raw) throw new UserError("Cet élément de l'inbox a changé entre-temps. Recharge la page.", 409);
    const text = item.text;
    let label: string;
    switch (action) {
      case "keep":
        return NextResponse.json({ label: null });
      case "delete":
        await removeInboxItem(index, raw);
        return NextResponse.json({ label: `Supprimé : ${text}` });
      case "project": {
        if (!project) throw new UserError("Choisis un projet.");
        const e = await readEditable("project", project);
        if (!e) throw new UserError("Projet introuvable.", 404);
        await editEntry("project", project, e.version, { op: "action-add", text });
        label = `${text} → action du projet « ${e.fields.title || project} »`;
        break;
      }
      case "notion":
        try {
          await addNotion({ term: text.slice(0, 120) }, todayISO());
          label = `${text} → notion (à compléter)`;
        } catch (err) {
          if ((err as { status?: number }).status !== 409) throw err;
          label = `${text} → déjà dans les notions`;
        }
        break;
      case "memo": {
        const { version } = await readMemo();
        await addMemo(version, { title: text.slice(0, 120), text: "", tags: [], pinned: false, date: todayISO() });
        label = `${text} → mémo`;
        break;
      }
    }
    await markInboxDone(index, raw);
    return NextResponse.json({ label });
  } catch (e) {
    return errorResponse(e);
  }
}
