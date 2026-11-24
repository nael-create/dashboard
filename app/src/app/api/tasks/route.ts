import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin, UserError } from "@/lib/api";
import { listProjects } from "@/lib/content";
import { parseTaskInput } from "@/lib/task-input";
import { todayISO } from "@/lib/dates";
import {
  addTask, deleteTask, moveTask, placeTask, planProjectAction, rollRecurring, setTaskStatus, updateTask, updateTaskSettings,
} from "@/lib/tasks";
import { scheduleTaskSync, taskSyncStatus } from "@/lib/task-sync";

export const dynamic = "force-dynamic";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const time = z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide.").nullable();
const recurrence = z.union([
  z.object({ kind: z.literal("daily") }),
  z.object({ kind: z.literal("weekly"), weekday: z.number().int().min(1).max(7) }),
  z.object({ kind: z.literal("monthly"), day: z.number().int().min(1).max(31) }),
]).nullable();
const fields = {
  title: z.string().max(300, "Titre trop long."),
  date,
  time: time.optional(),
  duration: z.number().int().min(1).max(1440).nullable().optional(),
  project: z.string().max(80).nullable().optional(),
  reminder: z.number().int().min(0).max(1440).nullable().optional(),
  recurrence: recurrence.optional(),
};
const id = z.string().regex(/^t-\d{8}-\d+$/, "Tâche inconnue.");

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), task: z.object(fields) }),
  z.object({ action: z.literal("quick"), text: z.string().trim().min(1, "Rien à ajouter.").max(300, "Texte trop long.") }),
  z.object({ action: z.literal("update"), version: z.string(), id, patch: z.object(fields).partial() }),
  z.object({ action: z.literal("status"), version: z.string(), id, status: z.enum(["todo", "done", "dropped"]) }),
  z.object({ action: z.literal("delete"), version: z.string(), id }),
  z.object({ action: z.literal("move"), version: z.string(), id, dir: z.union([z.literal(-1), z.literal(1)]) }),
  z.object({ action: z.literal("place"), version: z.string(), id, before: id.nullable() }),
  z.object({
    action: z.literal("plan"), slug: z.string().max(80), projectVersion: z.string(), index: z.number().int().min(0),
    text: z.string().max(300), date, time: time.optional(),
  }),
  z.object({
    action: z.literal("settings"), version: z.string(), settings: z.object({
      timezone: z.string().max(60).optional(), reminders: z.boolean().optional(),
      eveningDigest: z.string().regex(/^\d{2}:\d{2}$/).optional(), morningDigest: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      morningEnabled: z.boolean().optional(), autosync: z.boolean().optional(),
    }),
  }),
]);

/** Tâches (les récurrences dépassées sont d'abord reconduites), réglages et état de la synchro. */
export async function GET() {
  try {
    const today = todayISO();
    const cur = await rollRecurring(today);
    return NextResponse.json({ ...cur, today, sync: taskSyncStatus() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  const b = parsed.data;
  const today = todayISO();
  try {
    let out: Record<string, unknown>;
    switch (b.action) {
      case "add": {
        const r = await addTask(b.task, today);
        out = { version: r.version, task: r.result };
        break;
      }
      case "quick": {
        const slugs = (await listProjects()).map((p) => p.slug);
        const p = parseTaskInput(b.text, today, slugs);
        if (!p.title) throw new UserError("Il manque le titre de la tâche.");
        const r = await addTask({ title: p.title, date: p.date, time: p.time, duration: p.duration, project: p.project, reminder: p.reminder, recurrence: p.recurrence }, today);
        out = { version: r.version, task: r.result };
        break;
      }
      case "update":
        out = { version: (await updateTask(b.version, b.id, b.patch)).version };
        break;
      case "status": {
        const r = await setTaskStatus(b.version, b.id, b.status, today);
        out = { version: r.version, next: r.result?.next ?? null };
        break;
      }
      case "delete":
        out = { version: (await deleteTask(b.version, b.id)).version };
        break;
      case "move":
        out = { version: (await moveTask(b.version, b.id, b.dir)).version };
        break;
      case "place":
        out = { version: (await placeTask(b.version, b.id, b.before)).version };
        break;
      case "plan":
        out = await planProjectAction(b.slug, b.projectVersion, b.index, b.text, { date: b.date, time: b.time }, today);
        break;
      case "settings":
        out = { version: (await updateTaskSettings(b.version, b.settings)).version };
        break;
    }
    scheduleTaskSync();
    return NextResponse.json(out, { status: b.action === "add" || b.action === "quick" ? 201 : 200 });
  } catch (e) {
    return errorResponse(e);
  }
}
