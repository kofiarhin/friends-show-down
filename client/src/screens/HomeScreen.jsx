import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { setGame, resetGame } from "../store/gameSlice";
import { apiBase } from "../config";

const GENRES = [
  { slug: "mixed", label: "Mixed" },
  { slug: "science", label: "Science" },
  { slug: "geography", label: "Geography" },
  { slug: "history", label: "History" },
  { slug: "politics", label: "Politics" },
  { slug: "sports", label: "Sports" },
  { slug: "entertainment", label: "Entertainment" },
];

async function createGame(genre) {
  const res = await fetch(`${apiBase}/api/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ genre }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to create game.");
  }

  return res.json();
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("mixed");

  const mutation = useMutation({
    mutationFn: createGame,
    onSuccess: (data, genre) => {
      dispatch(resetGame());
      dispatch(
        setGame({
          gameId: data.gameId,
          isHost: true,
          hostToken: data.hostToken,
          genre,
        }),
      );
      navigate(`/game/${data.gameId}/join`);
    },
  });

  function handleSelectGenre(genre) {
    setSelectedGenre(genre);
    mutation.reset();
  }

  function handleCreateGame() {
    mutation.mutate(selectedGenre);
  }

  function handleJoin(e) {
    e.preventDefault();
    setJoinError("");
    const raw = joinInput.trim();

    if (!raw) {
      setJoinError("Enter a game ID or link.");
      return;
    }

    const match =
      raw.match(/\/game\/([^/]+)\//) || raw.match(/^([A-Za-z0-9_-]+)$/);

    if (!match) {
      setJoinError("Invalid game ID or link.");
      return;
    }

    const gameId = match[1];
    dispatch(resetGame());
    dispatch(setGame({ gameId, isHost: false }));
    navigate(`/game/${gameId}/join`);
  }

  const selectedGenreLabel =
    GENRES.find((genre) => genre.slug === selectedGenre)?.label ?? "Mixed";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-20 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute bottom-10 left-10 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur md:p-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-300/80">
              Real-time trivia
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-indigo-400 sm:text-5xl">
              Friends Showdown
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
              Create a room, share the code, and race to answer first.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200">
                Create
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200">
                Share
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200">
                Play
              </span>
            </div>
            <div className="mt-6 flex justify-center">
              <Link
                to="/leaderboard"
                className="rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
              >
                View weekly leaderboard
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 md:gap-5">
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-300/80">
                Host a game
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Start a room in seconds
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Pick a category and start a room for your friends right away.
              </p>

              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-200">
                  Choose a category
                </p>
                <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
                  {selectedGenreLabel}
                </span>
              </div>

              <div
                className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
                role="group"
                aria-label="Choose a category"
              >
                {GENRES.map(({ slug, label }) => (
                  <button
                    key={slug}
                    type="button"
                    aria-pressed={selectedGenre === slug}
                    onClick={() => handleSelectGenre(slug)}
                    className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                      selectedGenre === slug
                        ? "border-indigo-400 bg-indigo-600 text-white shadow-lg shadow-indigo-950/40"
                        : "border-white/10 bg-slate-800 text-slate-200 hover:border-slate-500 hover:bg-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mutation.isError && (
                <p className="mt-4 text-sm text-red-400">
                  {mutation.error.message}
                </p>
              )}

              <button
                type="button"
                onClick={handleCreateGame}
                disabled={mutation.isPending}
                className="mt-5 w-full rounded-2xl bg-indigo-600 px-4 py-3 text-lg font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mutation.isPending ? "Creating..." : "Create Game"}
              </button>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-300/80">
                Join a game
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Jump into the next round
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Paste an invite link or enter a room code to join your friends.
              </p>

              <form onSubmit={handleJoin} className="mt-6 flex flex-col gap-3">
                <label
                  htmlFor="join-game-input"
                  className="text-sm font-medium text-slate-200"
                >
                  Game ID or share link
                </label>
                <input
                  id="join-game-input"
                  type="text"
                  value={joinInput}
                  onChange={(e) => {
                    setJoinInput(e.target.value);
                    if (joinError) setJoinError("");
                  }}
                  placeholder="ABC123 or https://..."
                  aria-describedby="join-game-help"
                  className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <p id="join-game-help" className="text-sm text-slate-400">
                  Example: ABC123 or a full invite link
                </p>
                {joinError && (
                  <p className="text-sm text-red-400" role="alert">
                    {joinError}
                  </p>
                )}
                <button
                  type="submit"
                  className="mt-1 w-full rounded-2xl bg-slate-700 px-4 py-3 text-lg font-semibold text-white transition hover:bg-slate-600"
                >
                  Join Game
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
