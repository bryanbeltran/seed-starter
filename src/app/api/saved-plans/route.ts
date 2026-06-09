import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSavedPlan,
  listSavedPlans,
} from "@/persistence/savedPlanService";
import { ZoneLookupError } from "@/lib/zipToZone";

const createSchema = z.object({
  name: z.string().trim().min(1, "Plan name is required."),
  zip: z.string().trim().min(1),
  crops: z.array(z.string()).min(1),
  riskProfile: z.enum(["conservative", "balanced", "aggressive"]).optional(),
});

export async function GET() {
  const plans = await listSavedPlans();
  return NextResponse.json({ plans });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const plan = await createSavedPlan(parsed.data);
    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    if (err instanceof ZoneLookupError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Create saved plan failed:", err);
    return NextResponse.json(
      { error: "Could not save plan." },
      { status: 500 },
    );
  }
}
