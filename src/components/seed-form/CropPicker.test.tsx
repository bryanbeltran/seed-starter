import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CropPicker } from "./CropPicker";

const crops = [
  {
    id: "tomato",
    name: "Tomato",
    method: "transplant" as const,
    indoorSowOffsetDays: 56,
    daysToHarvest: 75,
    varieties: { cherry: { id: "cherry", name: "Cherry" } },
  },
];

describe("CropPicker", () => {
  it("toggles crop selection", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <CropPicker
        crops={crops}
        selected={[]}
        varieties={{}}
        loading={false}
        onToggle={onToggle}
        onVarietyChange={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("Tomato"));
    expect(onToggle).toHaveBeenCalledWith("tomato");
  });

  it("shows variety select when crop is selected", () => {
    render(
      <CropPicker
        crops={crops}
        selected={["tomato"]}
        varieties={{}}
        loading={false}
        onToggle={vi.fn()}
        onVarietyChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Tomato variety")).toBeInTheDocument();
  });
});
