"use client";

import { useMemo, useState } from "react";
import type { CropDefinition } from "@/planning";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { VarietySelect } from "./VarietySelect";

type Props = {
  crops: CropDefinition[];
  selected: string[];
  varieties: Record<string, string | undefined>;
  loading: boolean;
  cropError?: string | null;
  onToggle: (cropId: string) => void;
  onVarietyChange: (cropId: string, varietyId: string | undefined) => void;
};

export function CropPicker({
  crops,
  selected,
  varieties,
  loading,
  cropError,
  onToggle,
  onVarietyChange,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return crops;
    return crops.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [crops, query]);

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Crops</legend>
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search crops…"
        disabled={loading}
        aria-label="Search crops"
        className="h-9"
      />
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Selected crops"
        aria-describedby={cropError ? "crop-error" : undefined}
      >
        {filtered.map((crop) => {
          const checked = selected.includes(crop.id);
          return (
            <button
              key={crop.id}
              type="button"
              role="checkbox"
              aria-checked={checked}
              aria-label={crop.name}
              disabled={loading}
              onClick={() => onToggle(crop.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent bg-background",
              )}
            >
              {crop.name}
            </button>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <p className="text-muted-foreground text-sm">No crops match your search.</p>
      )}
      {selected.map((cropId) => {
        const crop = crops.find((c) => c.id === cropId);
        if (!crop) return null;
        return (
          <VarietySelect
            key={cropId}
            crop={crop}
            value={varieties[cropId]}
            disabled={loading}
            onChange={(v) => onVarietyChange(cropId, v)}
          />
        );
      })}
      {cropError && (
        <p id="crop-error" className="text-sm text-destructive" role="alert">
          {cropError}
        </p>
      )}
    </fieldset>
  );
}
