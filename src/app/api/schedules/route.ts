import { NextResponse } from "next/server";
import { buildSchedule, sowDatesFromSchedule } from "@/planning";
import { parseScheduleRequest } from "@/planning/api/scheduleRequestSchema";
import { zipToZone, ZoneLookupError } from "@/lib/zipToZone";

export async function POST(req: Request) {
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

  const { zip, seeds, riskProfile } = parsed.data;

  try {
    const zone = await zipToZone(zip);
    const schedule = buildSchedule({ zone, crops: seeds, riskProfile });
    const sowDates = sowDatesFromSchedule(schedule);

    return NextResponse.json({
      zone: schedule.zone,
      sowDates: sowDates.map(({ seed, date }) => ({
        seed,
        date: date.toISOString(),
      })),
    });
  } catch (err) {
    if (err instanceof ZoneLookupError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Schedule calculation failed:", err);
    return NextResponse.json(
      { error: "Could not calculate sow dates. Try again." },
      { status: 500 },
    );
  }
}
