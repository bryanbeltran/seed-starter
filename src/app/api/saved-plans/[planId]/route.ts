import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteSavedPlan,
  getSavedPlan,
  updateSavedPlan,
} from "@/persistence/savedPlanService";
import { ZoneLookupError } from "@/lib/zipToZone";

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  zip: z.string().trim().min(1).optional(),
  crops: z.array(z.string()).min(1).optional(),
  riskProfile: z.enum(["conservative", "balanced", "aggressive"]).optional(),
});

type Params = { params: Promise<{ planId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { planId } = await params;
  const plan = await getSavedPlan(planId);
  if (!plan) {
    return NextResponse.json({ error: "Plan not found." }, { status: 404 });
  }
  return NextResponse.json(plan);
}

export async function PATCH(req: Request, { params }: Params) {
  const { planId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const plan = await updateSavedPlan(planId, parsed.data);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }
    return NextResponse.json(plan);
  } catch (err) {
    if (err instanceof ZoneLookupError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Update saved plan failed:", err);
    return NextResponse.json(
      { error: "Could not update plan." },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { planId } = await params;
  const deleted = await deleteSavedPlan(planId);
  if (!deleted) {
    return NextResponse.json({ error: "Plan not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
