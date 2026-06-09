import Link from "next/link";
import { ScheduleResults } from "@/components/seed-form/ScheduleResults";
import { getSavedPlan } from "@/persistence/savedPlanService";

type Props = {
  searchParams: Promise<{ id?: string }>;
};

export default async function PlanPage({ searchParams }: Props) {
  const { id } = await searchParams;
  if (!id) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Plan not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Add <code>?id=plan-id</code> to view a saved plan.
        </p>
        <Link href="/" className="text-primary mt-4 inline-block text-sm underline">
          Back to planner
        </Link>
      </main>
    );
  }

  const plan = await getSavedPlan(id);
  if (!plan) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Plan not found</h1>
        <Link href="/" className="text-primary mt-4 inline-block text-sm underline">
          Back to planner
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-muted-foreground mb-4 inline-block text-sm print:hidden">
        ← Back to planner
      </Link>
      <ScheduleResults
        results={plan.schedule}
        zip={plan.zip}
        planName={plan.name}
      />
    </main>
  );
}
