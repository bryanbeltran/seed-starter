import * as postgres from "./postgresSavedPlans";
import * as sqlite from "./sqliteSavedPlans";
import type { SavedPlan, SavedPlanInput } from "./planHelpers";

export type { SavedPlan, SavedPlanInput } from "./planHelpers";

const store = process.env.DATABASE_URL ? postgres : sqlite;

export async function listSavedPlans(ownerId?: string | null): Promise<SavedPlan[]> {
  return store.listSavedPlans(ownerId);
}

export async function getSavedPlan(
  id: string,
  ownerId?: string | null,
): Promise<SavedPlan | null> {
  return store.getSavedPlan(id, ownerId);
}

export async function createSavedPlan(input: SavedPlanInput): Promise<SavedPlan> {
  return store.createSavedPlan(input);
}

export async function updateSavedPlan(
  id: string,
  patch: Partial<SavedPlanInput>,
  ownerId?: string | null,
): Promise<SavedPlan | null> {
  return store.updateSavedPlan(id, patch, ownerId);
}

export async function deleteSavedPlan(
  id: string,
  ownerId?: string | null,
): Promise<boolean> {
  return store.deleteSavedPlan(id, ownerId);
}

/** @internal test helper — sqlite only */
export const resetDbCacheForTests = sqlite.resetDbCacheForTests;
