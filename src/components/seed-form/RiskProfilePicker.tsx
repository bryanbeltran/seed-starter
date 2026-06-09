"use client";

import type { RiskProfile } from "@/planning";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const profiles: { id: RiskProfile; label: string; hint: string }[] = [
  { id: "conservative", label: "Conservative", hint: "Later spring planting" },
  { id: "balanced", label: "Balanced", hint: "Median frost dates" },
  { id: "aggressive", label: "Aggressive", hint: "Earlier spring planting" },
];

type Props = {
  value: RiskProfile;
  loading: boolean;
  onChange: (profile: RiskProfile) => void;
};

export function RiskProfilePicker({ value, loading, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label id="risk-profile-label">Risk profile</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as RiskProfile)}
        disabled={loading}
        aria-labelledby="risk-profile-label"
        className="grid gap-2"
      >
        {profiles.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary"
          >
            <RadioGroupItem value={p.id} id={`risk-${p.id}`} className="mt-0.5" />
            <span>
              <span className="text-sm font-medium">{p.label}</span>
              <span className="block text-xs text-muted-foreground">{p.hint}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
