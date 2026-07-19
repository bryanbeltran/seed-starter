"use client";

import type { GardenSeason } from "@/planning";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const seasons: { id: GardenSeason; label: string; hint: string }[] = [
  { id: "spring", label: "Spring", hint: "Anchored on last spring frost" },
  { id: "fall", label: "Fall", hint: "Anchored on first fall frost" },
];

type Props = {
  value: GardenSeason;
  loading: boolean;
  onChange: (season: GardenSeason) => void;
};

export function SeasonPicker({ value, loading, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label id="season-label">Season</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as GardenSeason)}
        disabled={loading}
        aria-labelledby="season-label"
        className="grid grid-cols-2 gap-2"
      >
        {seasons.map((s) => (
          <label
            key={s.id}
            className="flex cursor-pointer items-start gap-2 rounded-md border p-3 has-[:checked]:border-primary"
          >
            <RadioGroupItem value={s.id} id={`season-${s.id}`} className="mt-0.5" />
            <span>
              <span className="text-sm font-medium">{s.label}</span>
              <span className="block text-xs text-muted-foreground">{s.hint}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
