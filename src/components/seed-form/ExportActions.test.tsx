import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExportActions } from "./ExportActions";

const results = {
  zone: "5a",
  lastFrostDate: "2026-04-25T12:00:00.000Z",
  frostSource: "station",
  frostProvenance: "test",
  riskProfile: "balanced" as const,
  tasks: [
    {
      cropId: "tomato",
      type: "indoor_sow",
      date: "2026-02-28T12:00:00.000Z",
      label: "Sow Tomato indoors",
    },
  ],
  sowDates: [],
};

describe("ExportActions", () => {
  it("triggers print", async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<ExportActions results={results} zip="55423" />);
    await user.click(screen.getByRole("button", { name: "Print schedule" }));
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
