import { NextResponse } from "next/server";
import { parseScheduleRequest } from "@/planning/api/scheduleRequestSchema";
import { createScheduleFromRequest } from "@/lib/createScheduleFromRequest";
import { serializeSchedule } from "@/lib/serializeSchedule";
import { UnsupportedSeasonCropError } from "@/planning";
import { ZoneLookupError } from "@/lib/zipToZone";
import { apiRoute } from "@/lib/apiRoute";

export const POST = apiRoute("schedules", async (req) => {
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
    const schedule = await createScheduleFromRequest(parsed.data);
    return NextResponse.json(serializeSchedule(schedule));
  } catch (err) {
    if (err instanceof ZoneLookupError || err instanceof UnsupportedSeasonCropError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}, { limit: 30 });
