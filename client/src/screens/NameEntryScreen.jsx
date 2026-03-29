import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDispatch, useSelector } from "react-redux";
import { socket } from "../socket";
import { setGame, setPlayerId } from "../store/gameSlice";
import { apiBase } from "../config";

async function fetchGame(gameId) {
  const res = await fetch(`${apiBase}/api/games/${gameId}`);
  if (res.status === 404) throw new Error("Game not found.");
  if (res.status === 409) throw new Error("Game already in progress.");
  if (!res.ok) throw new Error("Failed to load game.");
  return res.json();
}

export default function NameEntryScreen() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isHost = useSelector((s) => s.game.isHost);

  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: gameData, error: gameError, isLoading } = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => fetchGame(gameId),
    retry: false,
  });

  useEffect(() => {
    if (gameError) {
      // If game not found, go home after a moment
      const t = setTimeout(() => navigate("/"), 2500);
      return () => clearTimeout(t);
    }
  }, [gameError, navigate]);

  useEffect(() => {
    function onJoinError({ message }) {
      setJoinError(message);
      setSubmitting(false);
    }

    function onLobbyUpdated() {
      navigate(`/game/${gameId}/lobby`);
    }

    socket.on("join:error", onJoinError);
    socket.on("lobby:updated", onLobbyUpdated);

    return () => {
      socket.off("join:error", onJoinError);
      socket.off("lobby:updated", onLobbyUpdated);
    };
  }, [gameId, navigate]);

  function handleSubmit(e) {
    e.preventDefault();
    setJoinError("");
    const trimmed = nickname.trim();

    if (!trimmed) {
      setJoinError("Nickname is required.");
      return;
    }
    if (trimmed.length > 20) {
      setJoinError("Nickname must be 20 characters or fewer.");
      return;
    }

    setSubmitting(true);
    dispatch(setGame({ gameId, nickname: trimmed, isHost }));
    if (socket.connected) dispatch(setPlayerId(socket.id));

    socket.emit("game:join", { gameId, nickname: trimmed, isHost });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading game…</p>
      </div>
    );
  }

  if (gameError) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-red-400">{gameError.message} Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-indigo-400">Join Game</h1>
        <p className="mt-2 text-gray-400 text-sm font-mono">
          Game ID: <span className="text-white">{gameId}</span>
        </p>
        {gameData?.genre && (
          <p className="mt-1 text-indigo-300 text-sm">
            Category: <span className="font-semibold capitalize">{gameData.genre}</span>
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Enter your nickname"
          maxLength={20}
          autoFocus
          className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-lg disabled:opacity-50 transition"
        >
          {submitting ? "Joining…" : "Join"}
        </button>
      </form>
    </div>
  );
}
