import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MiniLeaderboard from "./MiniLeaderboard";

describe("MiniLeaderboard", () => {
  it("highlights rows whose score changed from the previous scores", () => {
    render(
      <MiniLeaderboard
        previousScores={[
          { playerId: "p1", nickname: "Alice", score: 0 },
          { playerId: "p2", nickname: "Bob", score: 1 },
        ]}
        scores={[
          { playerId: "p1", nickname: "Alice", score: 1 },
          { playerId: "p2", nickname: "Bob", score: 1 },
        ]}
      />,
    );

    expect(screen.getByText("Alice").closest("div")).toHaveAttribute(
      "data-score-changed",
      "true",
    );
    expect(screen.getByText("Bob").closest("div")).toHaveAttribute(
      "data-score-changed",
      "false",
    );
  });
});
