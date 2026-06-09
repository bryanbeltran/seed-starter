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
});
