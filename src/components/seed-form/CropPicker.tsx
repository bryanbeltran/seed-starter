"use client";

import { useMemo, useState } from "react";
import type { CropDefinition } from "@/planning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CROP_FILTERS,
  type CropCategoryFilter,
  filterCrops,
} from "./cropPickerFilters";
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

function CropChip({
  crop,
  checked,
  loading,
  onToggle,
}: {
  crop: CropDefinition;
  checked: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={crop.name}
      disabled={loading}
      onClick={onToggle}
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
}

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
  const [category, setCategory] = useState<CropCategoryFilter>("popular");
  const [page, setPage] = useState(1);

  const searching = query.trim().length > 0;

  const { visible, total, hasMore } = useMemo(
    () => filterCrops({ crops, query, category, page }),
    [crops, query, category, page],
  );

  const visibleIds = useMemo(() => new Set(visible.map((c) => c.id)), [visible]);

  const pinnedSelected = useMemo(
    () =>
      selected
        .map((id) => crops.find((c) => c.id === id))
        .filter((c): c is CropDefinition => c != null && !visibleIds.has(c.id)),
    [selected, crops, visibleIds],
  );

  function onCategoryChange(next: CropCategoryFilter) {
    setCategory(next);
    setPage(1);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Crops</legend>
      <Input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search all crops…"
        disabled={loading}
        aria-label="Search crops"
        className="h-9"
      />
      {!searching && category === "popular" && (
        <p className="text-muted-foreground text-xs">
          Common MN garden crops. Search or browse for more.
        </p>
      )}
      {!searching && (
        <div
          className="flex min-w-0 gap-1.5 overflow-x-auto pb-1"
          role="group"
          aria-label="Crop categories"
        >
          {CROP_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={category === f.id}
              disabled={loading}
              onClick={() => onCategoryChange(f.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === f.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent bg-background",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
      {pinnedSelected.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium">Selected</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Selected crops">
            {pinnedSelected.map((crop) => (
              <CropChip
                key={crop.id}
                crop={crop}
                checked
                loading={loading}
                onToggle={() => onToggle(crop.id)}
              />
            ))}
          </div>
        </div>
      )}
      <p className="text-muted-foreground text-xs" aria-live="polite">
        {searching
          ? `${total} match${total === 1 ? "" : "es"}`
          : `Showing ${visible.length} of ${total}`}
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Available crops"
        aria-describedby={cropError ? "crop-error" : undefined}
      >
        {visible.map((crop) => (
          <CropChip
            key={crop.id}
            crop={crop}
            checked={selected.includes(crop.id)}
            loading={loading}
            onToggle={() => onToggle(crop.id)}
          />
        ))}
      </div>
      {visible.length === 0 && (
        <p className="text-muted-foreground text-sm">No crops match your search.</p>
      )}
      {hasMore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Show more ({total - visible.length} remaining)
        </Button>
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
