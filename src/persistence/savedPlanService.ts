import * as postgres from "./postgresSavedPlans";
import * as sqlite from "./sqliteSavedPlans";

export type { SavedPlan, SavedPlanInput } from "./planHelpers";

const store = process.env.DATABASE_URL ? postgres : sqlite;

export const listSavedPlans = store.listSavedPlans;
export const getSavedPlan = store.getSavedPlan;
export const createSavedPlan = store.createSavedPlan;
export const updateSavedPlan = store.updateSavedPlan;
export const deleteSavedPlan = store.deleteSavedPlan;

/** @internal test helper — sqlite only */
export const resetDbCacheForTests = sqlite.resetDbCacheForTests;
