import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CompareProfiles, type CompareResult } from "./CompareProfiles";
import type { ScheduleResult } from "./types";

function fallSchedule(riskProfile: ScheduleResult["riskProfile"], day: number): ScheduleResult {
  return {
    zone: "5a",
    season: "fall",
    riskProfile,
    lastFrostDate: "2026-10-15T12:00:00.000Z",
    frostSource: "climate",
    frostProvenance: "test",
    tasks: [
      {
        cropId: "carrot",
        type: "fall_sow",
        date: `2026-08-${day}T12:00:00.000Z`,
        label: "Sow Carrot for fall harvest",
      },
      {
        cropId: "carrot",
        type: "harvest",
        date: "2026-10-10T12:00:00.000Z",
        label: "Harvest Carrot",
      },
    ],
    sowDates: [],
  };
}

describe("CompareProfiles", () => {
  afterEach(cleanup);

  it("compares fall sowing dates against the selected baseline", async () => {
    const user = userEvent.setup();
    const compared: CompareResult = {
      conservative: fallSchedule("conservative", 10),
      balanced: fallSchedule("balanced", 15),
      aggressive: fallSchedule("aggressive", 20),
    };
    render(<CompareProfiles compared={compared} baseline="balanced" />);

    const baseline = within(screen.getByRole("tabpanel"));
    expect(baseline.getByText(/Sow Carrot for fall harvest/)).toBeInTheDocument();
    expect(baseline.queryByText(/Harvest Carrot/)).not.toBeInTheDocument();
    expect(baseline.queryByText(/\([+-]?\d+d\)/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "conservative" }));
    expect(within(screen.getByRole("tabpanel")).getByText("(-5d)")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "aggressive" }));
    expect(within(screen.getByRole("tabpanel")).getByText("(+5d)")).toBeInTheDocument();
  });
});
