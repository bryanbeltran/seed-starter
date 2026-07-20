"use client";

import type { GardenSeason, RiskProfile } from "@/planning";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const SPRING_HINTS: Record<RiskProfile, string> = {
  conservative: "Later spring planting",
  balanced: "Median frost dates",
  aggressive: "Earlier spring planting",
};

const FALL_HINTS: Record<RiskProfile, string> = {
  conservative: "Earlier fall frost (safer)",
  balanced: "Median frost dates",
  aggressive: "Later fall frost",
};

const profiles: { id: RiskProfile; label: string }[] = [
  { id: "conservative", label: "Conservative" },
  { id: "balanced", label: "Balanced" },
  { id: "aggressive", label: "Aggressive" },
];

type Props = {
  value: RiskProfile;
  loading: boolean;
  onChange: (profile: RiskProfile) => void;
  season?: GardenSeason;
};

export function RiskProfilePicker({
  value,
  loading,
  onChange,
  season = "spring",
}: Props) {
  const hints = season === "fall" ? FALL_HINTS : SPRING_HINTS;
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
              <span className="block text-xs text-muted-foreground">
                {hints[p.id]}
              </span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
