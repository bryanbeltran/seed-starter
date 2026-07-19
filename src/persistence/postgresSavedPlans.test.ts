import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createSavedPlan,
  deleteSavedPlan,
  getSavedPlan,
  listSavedPlans,
  resetPostgresMigratedForTests,
  updateSavedPlan,
} from "./postgresSavedPlans";

const hasDb = Boolean(process.env.DATABASE_URL);
const created: string[] = [];

beforeAll(() => {
  if (!hasDb) return;
  resetPostgresMigratedForTests();
});

afterEach(async () => {
  if (!hasDb) return;
  while (created.length) {
    const id = created.pop()!;
    await deleteSavedPlan(id);
  }
  resetPostgresMigratedForTests();
});

describe.skipIf(!hasDb)("postgresSavedPlans", () => {
  it("creates, lists by owner, blocks cross-owner write", async () => {
    const a = await createSavedPlan({
      name: `ci-a-${Date.now()}`,
      zip: "55423",
      crops: ["tomato"],
      ownerId: "owner-a",
    });
    created.push(a.id);

    const b = await createSavedPlan({
      name: `ci-b-${Date.now()}`,
      zip: "10001",
      crops: ["basil"],
      ownerId: "owner-b",
    });
    created.push(b.id);

    const listed = await listSavedPlans("owner-a");
    expect(listed.some((p) => p.id === a.id)).toBe(true);
    expect(listed.some((p) => p.id === b.id)).toBe(false);

    expect(await getSavedPlan(a.id, "owner-a")).not.toBeNull();
    expect(await getSavedPlan(a.id, "owner-b")).toBeNull();
    expect(await updateSavedPlan(a.id, { name: "hacked" }, "owner-b")).toBeNull();
    expect(await deleteSavedPlan(a.id, "owner-b")).toBe(false);

    const renamed = await updateSavedPlan(a.id, { name: "ok" }, "owner-a");
    expect(renamed?.name).toBe("ok");
  });

  it("blocks write on legacy unowned when auth owner present", async () => {
    const orphan = await createSavedPlan({
      name: `ci-orphan-${Date.now()}`,
      zip: "55423",
      crops: ["lettuce"],
      ownerId: null,
    });
    created.push(orphan.id);

    expect(await getSavedPlan(orphan.id, "owner-a")).not.toBeNull();
    expect(await updateSavedPlan(orphan.id, { name: "x" }, "owner-a")).toBeNull();
    expect(await deleteSavedPlan(orphan.id)).toBe(true);
    created.pop();
  });

  it("persists season on create, get, and list", async () => {
    const plan = await createSavedPlan({
      name: `ci-fall-${Date.now()}`,
      zip: "55423",
      crops: ["carrot"],
      season: "fall",
      ownerId: "owner-fall",
    });
    created.push(plan.id);

    expect(plan.season).toBe("fall");
    expect(plan.schedule.season).toBe("fall");
    expect(plan.schedule.tasks.some((t) => t.type === "fall_sow")).toBe(true);

    const fetched = await getSavedPlan(plan.id, "owner-fall");
    expect(fetched?.season).toBe("fall");
    expect(fetched?.schedule.season).toBe("fall");
    expect(fetched?.schedule.tasks.some((t) => t.type === "fall_sow")).toBe(true);

    const listed = await listSavedPlans("owner-fall");
    const row = listed.find((p) => p.id === plan.id);
    expect(row?.season).toBe("fall");
    expect(row?.schedule.tasks.some((t) => t.type === "fall_sow")).toBe(true);
  });
});
