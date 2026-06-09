import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ResultsPlaceholder() {
  return (
    <Card className="border-dashed print:hidden">
      <CardHeader>
        <CardTitle>Your timeline</CardTitle>
        <CardDescription>
          Your planting schedule will appear here after you calculate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Pick a ZIP code, select crops, and choose a risk profile to build a
          frost-aware timeline with sow, transplant, and harvest dates.
        </p>
      </CardContent>
    </Card>
  );
}
