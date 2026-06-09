import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScheduleResults } from "./ScheduleResults";

const results = {
  zone: "5a",
  lastFrostDate: "2026-04-25T12:00:00.000Z",
  frostSource: "station",
  frostProvenance: "NOAA fixture",
  riskProfile: "balanced" as const,
  tasks: [
    {
      cropId: "tomato",
      type: "indoor_sow",
      date: "2026-02-28T12:00:00.000Z",
      label: "Sow Tomato indoors",
    },
  ],
  sowDates: [{ seed: "tomato", date: "2026-02-28T12:00:00.000Z" }],
};

describe("ScheduleResults", () => {
  it("renders grouped timeline", () => {
    render(<ScheduleResults results={results} zip="55423" />);
    expect(screen.getByText("Zone 5A")).toBeInTheDocument();
    expect(screen.getByText("station frost")).toBeInTheDocument();
    expect(screen.getByText("Sow Tomato indoors")).toBeInTheDocument();
  });
});
