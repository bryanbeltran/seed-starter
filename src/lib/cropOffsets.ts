/** @deprecated Use @/planning/cropCatalog instead. */
import { getCropOrDefault } from "@/planning/cropCatalog";

export const cropOffsets: Record<string, number> = {
  tomato: 56,
  pepper: 56,
  lettuce: 30,
  carrot: 14,
  broccoli: 84,
};

export function offsetForCrop(cropId: string): number {
  return getCropOrDefault(cropId).indoorSowOffsetDays;
}
