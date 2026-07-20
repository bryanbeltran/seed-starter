import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RiskProfilePicker } from "./RiskProfilePicker";

describe("RiskProfilePicker", () => {
  it("changes risk profile", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RiskProfilePicker value="balanced" loading={false} onChange={onChange} />,
    );
    await user.click(screen.getByRole("radio", { name: /aggressive/i }));
    expect(onChange).toHaveBeenCalledWith("aggressive");
  });

  it("shows fall-aware hints when season is fall", () => {
    render(
      <RiskProfilePicker
        value="balanced"
        loading={false}
        onChange={() => {}}
        season="fall"
      />,
    );
    expect(screen.getByText(/Earlier fall frost/i)).toBeInTheDocument();
  });

  it("shows summer-aware hints when season is summer", () => {
    render(
      <RiskProfilePicker
        value="conservative"
        loading={false}
        onChange={() => {}}
        season="summer"
      />,
    );
    expect(screen.getByText(/Later summer planting/i)).toBeInTheDocument();
  });
});
