import { NextResponse } from "next/server";
import { parseScheduleRequest } from "@/planning/api/scheduleRequestSchema";
import { compareSchedulesFromRequest } from "@/lib/createScheduleFromRequest";
import { serializeSchedule } from "@/lib/serializeSchedule";
import { ZoneLookupError } from "@/lib/zipToZone";
import { apiRoute } from "@/lib/apiRoute";

export const POST = apiRoute("schedules-compare", async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseScheduleRequest(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const compared = await compareSchedulesFromRequest(parsed.data);
    return NextResponse.json({
      conservative: serializeSchedule(compared.conservative),
      balanced: serializeSchedule(compared.balanced),
      aggressive: serializeSchedule(compared.aggressive),
    });
  } catch (err) {
    if (err instanceof ZoneLookupError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}, { limit: 20 });
