import type { RiskProfile } from "@/planning";
import { Label } from "@/components/ui/label";

const profiles: { id: RiskProfile; label: string; hint: string }[] = [
  {
    id: "conservative",
    label: "Conservative",
    hint: "Later spring planting",
  },
  {
    id: "balanced",
    label: "Balanced",
    hint: "Median frost dates",
  },
  {
    id: "aggressive",
    label: "Aggressive",
    hint: "Earlier spring planting",
  },
];

type Props = {
  value: RiskProfile;
  loading: boolean;
  onChange: (profile: RiskProfile) => void;
};

export function RiskProfilePicker({ value, loading, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label>Risk profile</Label>
      <div className="grid gap-2">
        {profiles.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm has-checked:border-primary"
          >
            <input
              type="radio"
              name="riskProfile"
              value={p.id}
              checked={value === p.id}
              onChange={() => onChange(p.id)}
              disabled={loading}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{p.label}</span>
              <span className="block text-muted-foreground">{p.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
