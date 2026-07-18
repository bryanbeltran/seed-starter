import { Button } from "@/components/ui/button";

type Props = {
  onExample: () => void;
  loading?: boolean;
};

export function PlannerHero({ onExample, loading }: Props) {
  return (
    <section className="from-primary/8 mb-6 rounded-xl border bg-gradient-to-br to-transparent p-4 md:p-5">
      <h1 className="text-lg font-semibold tracking-tight md:text-xl">
        Plan your frost-aware garden
      </h1>
      <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
        Enter your ZIP, pick crops, and get sow, transplant, and harvest dates tuned
        to local frost risk.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        disabled={loading}
        onClick={onExample}
      >
        See example plan
      </Button>
    </section>
  );
}
