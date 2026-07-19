import Link from "next/link";
import { AppFooter } from "@/components/layout/AppFooter";
import { AppHeader } from "@/components/layout/AppHeader";
import { PlanShareBar } from "@/components/seed-form/PlanShareBar";
import { ScheduleResults } from "@/components/seed-form/ScheduleResults";
import { getSavedPlan } from "@/persistence/savedPlanService";

type Props = {
  searchParams: Promise<{ id?: string }>;
};

export default async function PlanPage({ searchParams }: Props) {
  const { id } = await searchParams;
  if (!id) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">Plan not found</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Add <code>?id=plan-id</code> to view a saved plan.
          </p>
          <Link href="/" className="text-primary mt-4 inline-block text-sm underline">
            Back to planner
          </Link>
        </main>
        <AppFooter />
      </>
    );
  }

  const plan = await getSavedPlan(id);
  if (!plan) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">Plan not found</h1>
          <Link href="/" className="text-primary mt-4 inline-block text-sm underline">
            Back to planner
          </Link>
        </main>
        <AppFooter />
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
        <Link href="/" className="text-muted-foreground mb-4 inline-block text-sm print:hidden">
          ← Back to planner
        </Link>
        <PlanShareBar
          planId={plan.id}
          planName={plan.name}
          season={plan.season ?? plan.schedule.season}
        />
        <ScheduleResults
          results={plan.schedule}
          zip={plan.zip}
          planName={plan.name}
        />
      </main>
      <AppFooter />
    </>
  );
}
