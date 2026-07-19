import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteSavedPlan,
  getSavedPlan,
  updateSavedPlan,
} from "@/persistence/savedPlanService";
import { UnsupportedSeasonCropError } from "@/planning";
import { ZoneLookupError } from "@/lib/zipToZone";
import { apiRoute } from "@/lib/apiRoute";
import { requireOwnerId } from "@/lib/ownerAuth";

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  zip: z.string().trim().min(1).optional(),
  crops: z.array(z.string()).min(1).optional(),
  riskProfile: z.enum(["conservative", "balanced", "aggressive"]).optional(),
  season: z.enum(["spring", "fall", "summer"]).optional(),
});

type Params = { params: Promise<{ planId: string }> };

async function withParams(
  req: Request,
  params: Promise<{ planId: string }>,
  run: (planId: string) => Promise<Response>,
) {
  const { planId } = await params;
  return run(planId);
}

export async function GET(req: Request, { params }: Params) {
  return apiRoute("saved-plans-get", async () =>
    withParams(req, params, async (planId) => {
      const ownerId = await requireOwnerId();
      const plan = await getSavedPlan(planId, ownerId);
      if (!plan) {
        return NextResponse.json({ error: "Plan not found." }, { status: 404 });
      }
      return NextResponse.json(plan);
    }),
  )(req);
}

export async function PATCH(req: Request, { params }: Params) {
  return apiRoute("saved-plans-patch", async (r) =>
    withParams(r, params, async (planId) => {
      let body: unknown;
      try {
        body = await r.json();
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
        const ownerId = await requireOwnerId();
        const plan = await updateSavedPlan(planId, parsed.data, ownerId);
        if (!plan) {
          return NextResponse.json({ error: "Plan not found." }, { status: 404 });
        }
        return NextResponse.json(plan);
      } catch (err) {
        if (err instanceof ZoneLookupError || err instanceof UnsupportedSeasonCropError) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }
    }),
  )(req);
}

export async function DELETE(req: Request, { params }: Params) {
  return apiRoute("saved-plans-delete", async () =>
    withParams(req, params, async (planId) => {
      const ownerId = await requireOwnerId();
      const deleted = await deleteSavedPlan(planId, ownerId);
      if (!deleted) {
        return NextResponse.json({ error: "Plan not found." }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }),
  )(req);
}
