import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskTimeline } from "./TaskTimeline";

describe("TaskTimeline", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // Also run in timezones west and east of UTC to exercise date boundaries.
  it.each(["2026-03-08T00:00:00.000Z", "2026-03-08T12:00:00.000Z"])(
    "displays the exported planting date and local Today status for %s",
    (date) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 8, 12));
      render(<TaskTimeline tasks={[
        { cropId: "tomato", type: "indoor_sow", date, label: "Sow Tomato indoors" },
      ]} />);

      expect(screen.getByText("Mar 8, 2026 · Today")).toBeInTheDocument();
    },
  );
});
