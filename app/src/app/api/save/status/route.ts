import { NextResponse } from "next/server";
import config from "@config";
import { errorResponse } from "@/lib/api";
import { saveStatus } from "@/lib/git";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ ...(await saveStatus()), reminderDays: config.saveReminderDays });
  } catch (e) {
    return errorResponse(e);
  }
}
