import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShareLink from "./ShareLink";

describe("ShareLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders room code, invite URL, and QR code", () => {
    render(
      <ShareLink
        gameId="ABC123"
        gameUrl="https://friends.example/game/ABC123/join"
      />,
    );

    expect(screen.getByText("Room code")).toBeInTheDocument();
    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(screen.getByLabelText("Invite URL")).toHaveValue(
      "https://friends.example/game/ABC123/join",
    );
    expect(screen.getByTestId("invite-qr")).toBeInTheDocument();
  });

  it("copies invite URL to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(
      <ShareLink
        gameId="ABC123"
        gameUrl="https://friends.example/game/ABC123/join"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "https://friends.example/game/ABC123/join",
      );
    });
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument();
  });

  it("shows an error when clipboard copy fails", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error("No clipboard"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(
      <ShareLink
        gameId="ABC123"
        gameUrl="https://friends.example/game/ABC123/join"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not copy link. Please copy it manually.",
    );
  });
});
