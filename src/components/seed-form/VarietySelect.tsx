"use client";

import type { CropDefinition } from "@/planning";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  crop: CropDefinition;
  value?: string;
  disabled?: boolean;
  onChange: (varietyId: string | undefined) => void;
};

export function VarietySelect({ crop, value, disabled, onChange }: Props) {
  const varieties = Object.values(crop.varieties ?? {});
  if (varieties.length === 0) return null;

  return (
    <div className="ml-6 mt-1">
      <Label className="text-xs text-muted-foreground" htmlFor={`variety-${crop.id}`}>
        Variety
      </Label>
      <Select
        value={value ?? "default"}
        onValueChange={(v) => onChange(v === "default" ? undefined : v)}
        disabled={disabled}
      >
        <SelectTrigger id={`variety-${crop.id}`} className="mt-1" aria-label={`${crop.name} variety`}>
          <SelectValue placeholder="Default" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Default</SelectItem>
          {varieties.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
