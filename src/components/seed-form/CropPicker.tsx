import type { CropDefinition } from "@/planning";

type Props = {
  crops: CropDefinition[];
  selected: string[];
  loading: boolean;
  onToggle: (cropId: string) => void;
};

export function CropPicker({ crops, selected, loading, onToggle }: Props) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Crops</legend>
      {crops.map((crop) => (
        <label
          key={crop.id}
          className="flex cursor-pointer items-center gap-2 text-sm"
        >
          <input
            type="checkbox"
            checked={selected.includes(crop.id)}
            onChange={() => onToggle(crop.id)}
            disabled={loading}
            className="size-4 rounded border-input"
          />
          {crop.name}
        </label>
      ))}
    </fieldset>
  );
}
