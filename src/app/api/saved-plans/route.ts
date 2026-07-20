import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSavedPlan,
  listSavedPlans,
} from "@/persistence/savedPlanService";
import { UnsupportedSeasonCropError } from "@/planning";
import { ZoneLookupError } from "@/lib/zipToZone";
import { apiRoute } from "@/lib/apiRoute";
import { requireOwnerId } from "@/lib/ownerAuth";

const createSchema = z.object({
  name: z.string().trim().min(1, "Plan name is required."),
  zip: z.string().trim().min(1),
  crops: z.array(z.string()).min(1),
  varieties: z.record(z.string(), z.string()).optional(),
  riskProfile: z.enum(["conservative", "balanced", "aggressive"]).optional(),
  season: z.enum(["spring", "fall", "summer"]).optional(),
});

export const GET = apiRoute("saved-plans-list", async () => {
  const ownerId = await requireOwnerId();
  const plans = await listSavedPlans(ownerId);
  return NextResponse.json({ plans, auth: Boolean(ownerId) });
});

export const POST = apiRoute("saved-plans-create", async (req) => {
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
    const ownerId = await requireOwnerId();
    const plan = await createSavedPlan({ ...parsed.data, ownerId });
    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    if (err instanceof ZoneLookupError || err instanceof UnsupportedSeasonCropError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}, { limit: 20 });
