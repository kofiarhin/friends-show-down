import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import CountdownTimer from "./CountdownTimer";

describe("CountdownTimer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks the timer as critical in the final three seconds", () => {
    vi.useFakeTimers();

    render(<CountdownTimer timeLimit={6} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByTestId("countdown-timer")).toHaveAttribute(
      "data-urgency",
      "critical",
    );
    expect(screen.getByText("3s")).toBeInTheDocument();
  });
});
