import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CropPicker } from "./CropPicker";

afterEach(() => cleanup());

const crops = [
  {
    id: "tomato",
    name: "Tomato",
    method: "transplant" as const,
    indoorSowOffsetDays: 56,
    daysToHarvest: 75,
    category: "vegetable" as const,
    varieties: { cherry: { id: "cherry", name: "Cherry" } },
  },
  {
    id: "basil",
    name: "Basil",
    method: "transplant" as const,
    daysToHarvest: 45,
    category: "herb" as const,
  },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `extra-${i}`,
    name: `Extra ${i}`,
    method: "direct" as const,
    daysToHarvest: 40,
    category: "vegetable" as const,
  })),
];

describe("CropPicker", () => {
  it("shows popular crops by default", () => {
    render(
      <CropPicker
        crops={crops}
        selected={[]}
        varieties={{}}
        loading={false}
        onToggle={vi.fn()}
        onVarietyChange={vi.fn()}
      />,
    );
    const available = screen.getByRole("group", { name: "Available crops" });
    expect(within(available).getByRole("checkbox", { name: "Tomato" })).toBeInTheDocument();
    expect(within(available).queryByRole("checkbox", { name: "Extra 0" })).not.toBeInTheDocument();
  });

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
    const available = screen.getByRole("group", { name: "Available crops" });
    await user.click(within(available).getByRole("checkbox", { name: "Tomato" }));
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

  it("browses all crops via category filter", async () => {
    const user = userEvent.setup();
    render(
      <CropPicker
        crops={crops}
        selected={[]}
        varieties={{}}
        loading={false}
        onToggle={vi.fn()}
        onVarietyChange={vi.fn()}
      />,
    );
    const categories = screen.getByRole("group", { name: "Crop categories" });
    await user.click(within(categories).getByRole("button", { name: "All" }));
    const available = screen.getByRole("group", { name: "Available crops" });
    expect(within(available).getByRole("checkbox", { name: "Extra 0" })).toBeInTheDocument();
  });

  it("pins selected crops outside current filter", async () => {
    const user = userEvent.setup();
    render(
      <CropPicker
        crops={crops}
        selected={["extra-0"]}
        varieties={{}}
        loading={false}
        onToggle={vi.fn()}
        onVarietyChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("group", { name: "Selected crops" })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox", { name: "Extra 0" })).toHaveLength(1);
    const categories = screen.getByRole("group", { name: "Crop categories" });
    await user.click(within(categories).getByRole("button", { name: "Herbs" }));
    expect(screen.getAllByRole("checkbox", { name: "Extra 0" })).toHaveLength(1);
  });
});
