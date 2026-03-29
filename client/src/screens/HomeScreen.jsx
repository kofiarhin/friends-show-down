import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [showGenreSelector, setShowGenreSelector] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState(null);

  const mutation = useMutation({
    mutationFn: createGame,
    onSuccess: (data, genre) => {
      dispatch(resetGame());
      dispatch(setGame({ gameId: data.gameId, isHost: true, genre }));
      navigate(`/game/${data.gameId}/join`);
    },
  });

  function handleCreateClick() {
    setShowGenreSelector(true);
    mutation.reset();
  }

  function handleConfirm() {
    if (!selectedGenre) return;
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
    const match = raw.match(/\/game\/([^/]+)\//) || raw.match(/^([A-Za-z0-9_-]+)$/);
    if (!match) {
      setJoinError("Invalid game ID or link.");
      return;
    }
    const gameId = match[1];
    dispatch(resetGame());
    dispatch(setGame({ gameId, isHost: false }));
    navigate(`/game/${gameId}/join`);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-10 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-indigo-400">
          Friends Showdown
        </h1>
        <p className="mt-3 text-gray-400 text-lg">
          Speed-based real-time multiplayer trivia
        </p>
      </div>

      <div className="flex flex-col gap-6 w-full max-w-sm">
        {!showGenreSelector ? (
          <button
            onClick={handleCreateClick}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-lg transition"
          >
            Create Game
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-400 text-center">Choose a category</p>
            <div className="grid grid-cols-2 gap-2">
              {GENRES.map(({ slug, label }) => (
                <button
                  key={slug}
                  onClick={() => setSelectedGenre(slug)}
                  className={`py-2.5 rounded-xl font-semibold text-sm transition border ${
                    selectedGenre === slug
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mutation.isError && (
              <p className="text-red-400 text-sm text-center">{mutation.error.message}</p>
            )}

            <button
              onClick={handleConfirm}
              disabled={!selectedGenre || mutation.isPending}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {mutation.isPending ? "Creating…" : "Confirm"}
            </button>
            <button
              onClick={() => {
                setShowGenreSelector(false);
                setSelectedGenre(null);
                mutation.reset();
              }}
              className="w-full py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        )}

        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <input
            type="text"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            placeholder="Game ID or share link"
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold text-lg transition"
          >
            Join Game
          </button>
        </form>
      </div>
    </div>
  );
}
