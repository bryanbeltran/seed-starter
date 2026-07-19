"use client";

import type { GardenSeason } from "@/planning";
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
    <fieldset className="space-y-2" disabled={loading}>
      <legend id="season-label" className="text-sm font-medium">
        Season
      </legend>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as GardenSeason)}
        aria-labelledby="season-label"
        className="grid grid-cols-2 gap-2"
      >
        {seasons.map((s) => (
          <label
            key={s.id}
            htmlFor={`season-${s.id}`}
            className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md border p-3 has-[:checked]:border-primary focus-within:ring-2 focus-within:ring-ring"
          >
            <RadioGroupItem
              value={s.id}
              id={`season-${s.id}`}
              className="mt-0.5"
              aria-describedby={`season-${s.id}-hint`}
            />
            <span>
              <span className="text-sm font-medium">{s.label}</span>
              <span
                id={`season-${s.id}-hint`}
                className="block text-xs text-muted-foreground"
              >
                {s.hint}
              </span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
