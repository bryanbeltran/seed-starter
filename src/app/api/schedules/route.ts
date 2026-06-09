import { NextResponse } from "next/server";
import { calculateSowDates } from "@/lib/calculateSowDates";
import { ZoneLookupError } from "@/lib/zipToZone";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { zip, seeds } = body as { zip?: string; seeds?: string[] };

  if (!zip?.trim()) {
    return NextResponse.json({ error: "ZIP code is required." }, { status: 400 });
  }
  if (!Array.isArray(seeds) || seeds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one crop." },
      { status: 400 },
    );
  }

  try {
    const { zone, sowDates } = await calculateSowDates(zip, seeds);
    return NextResponse.json({
      zone,
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
