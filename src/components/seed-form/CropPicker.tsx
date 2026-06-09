"use client";

import type { CropDefinition } from "@/planning";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Crops</legend>
      {crops.map((crop) => {
        const checked = selected.includes(crop.id);
        return (
          <div key={crop.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`crop-${crop.id}`}
                checked={checked}
                onCheckedChange={() => onToggle(crop.id)}
                disabled={loading}
              />
              <Label htmlFor={`crop-${crop.id}`} className="cursor-pointer font-normal">
                {crop.name}
              </Label>
            </div>
            {checked && (
              <VarietySelect
                crop={crop}
                value={varieties[crop.id]}
                disabled={loading}
                onChange={(v) => onVarietyChange(crop.id, v)}
              />
            )}
          </div>
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
