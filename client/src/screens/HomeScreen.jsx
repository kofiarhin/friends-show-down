import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { setGame, resetGame } from "../store/gameSlice";
import { apiBase } from "../config";

async function createGame() {
  const res = await fetch(`${apiBase}/api/games`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create game.");
  return res.json();
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState("");

  const mutation = useMutation({
    mutationFn: createGame,
    onSuccess: (data) => {
      dispatch(resetGame());
      dispatch(setGame({ gameId: data.gameId, isHost: true }));
      navigate(`/game/${data.gameId}/join`);
    },
  });

  function handleJoin(e) {
    e.preventDefault();
    setJoinError("");
    const raw = joinInput.trim();
    if (!raw) {
      setJoinError("Enter a game ID or link.");
      return;
    }
    // Extract game ID from a full URL or bare ID
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
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-lg disabled:opacity-50 transition"
        >
          {mutation.isPending ? "Creating…" : "Create Game"}
        </button>

        {mutation.isError && (
          <p className="text-red-400 text-sm text-center">{mutation.error.message}</p>
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
