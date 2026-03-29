import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import gameReducer from "../store/gameSlice";
import HomeScreen from "./HomeScreen";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../config", () => ({
  apiBase: "",
}));

function renderHome() {
  const store = configureStore({
    reducer: { game: gameReducer },
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    store,
    ...render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <HomeScreen />
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>,
    ),
  };
}

describe("HomeScreen", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders host and join sections on first load", () => {
    renderHome();

    expect(screen.getByText("Host a game")).toBeInTheDocument();
    expect(screen.getByText("Join a game")).toBeInTheDocument();
    expect(screen.getByText("Create a room, share the code, and race to answer first.")).toBeInTheDocument();
  });

  it("defaults the host flow to the mixed genre", () => {
    renderHome();

    expect(screen.getByRole("button", { name: "Mixed" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("updates the selected genre before creating a game", async () => {
    const user = userEvent.setup();
    renderHome();

    const mixedButton = screen.getByRole("button", { name: "Mixed" });
    const scienceButton = screen.getByRole("button", { name: "Science" });

    await user.click(scienceButton);

    expect(scienceButton).toHaveAttribute("aria-pressed", "true");
    expect(mixedButton).toHaveAttribute("aria-pressed", "false");
  });

  it("creates a game with the selected genre and stores the host session", async () => {
    const user = userEvent.setup();
    const { store } = renderHome();

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ gameId: "ROOM123", hostToken: "host-token" }),
    });

    await user.click(screen.getByRole("button", { name: "Science" }));
    await user.click(screen.getByRole("button", { name: "Create Game" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    expect(fetch).toHaveBeenCalledWith("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genre: "science" }),
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/game/ROOM123/join");
    });

    expect(store.getState().game).toMatchObject({
      gameId: "ROOM123",
      isHost: true,
      hostToken: "host-token",
      genre: "science",
    });
  });

  it("joins with a room code and stores the guest session", async () => {
    const user = userEvent.setup();
    const { store } = renderHome();

    await user.type(screen.getByLabelText("Game ID or share link"), "ROOM456");
    await user.click(screen.getByRole("button", { name: "Join Game" }));

    expect(navigateMock).toHaveBeenCalledWith("/game/ROOM456/join");
    expect(store.getState().game).toMatchObject({
      gameId: "ROOM456",
      isHost: false,
    });
  });

  it("joins with a full invite link", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.type(
      screen.getByLabelText("Game ID or share link"),
      "https://example.com/game/ROOM789/join",
    );
    await user.click(screen.getByRole("button", { name: "Join Game" }));

    expect(navigateMock).toHaveBeenCalledWith("/game/ROOM789/join");
  });

  it("shows a validation error for invalid join input", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.type(screen.getByLabelText("Game ID or share link"), "not a code");
    await user.click(screen.getByRole("button", { name: "Join Game" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid game ID or link.",
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
