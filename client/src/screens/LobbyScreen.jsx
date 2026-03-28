import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { socket } from "../socket";
import { useSocketEvents } from "../hooks/useSocketEvents";
import PlayerList from "../components/PlayerList";
import ShareLink from "../components/ShareLink";

export default function LobbyScreen() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { players, isHost, nickname } = useSelector((s) => s.game);

  useSocketEvents(gameId);

  // Guard: if no nickname registered, go to name entry
  useEffect(() => {
    if (!nickname) {
      navigate(`/game/${gameId}/join`);
    }
  }, [nickname, gameId, navigate]);

  function handleStart() {
    socket.emit("game:start", { gameId });
  }

  const connectedCount = players.filter((p) => p.connected).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-indigo-400">Lobby</h1>
        <p className="mt-1 text-gray-500 text-sm font-mono">Game: {gameId}</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-6">
        <div>
          <p className="text-sm text-gray-400 mb-2">
            Players ({connectedCount})
          </p>
          <PlayerList players={players} />
        </div>

        <div>
          <p className="text-sm text-gray-400 mb-2">Share link</p>
          <ShareLink gameId={gameId} />
        </div>

        {isHost && (
          <button
            onClick={handleStart}
            disabled={connectedCount < 2}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {connectedCount < 2
              ? `Waiting for players… (${connectedCount}/2)`
              : "Start Game"}
          </button>
        )}

        {!isHost && (
          <p className="text-center text-gray-500 text-sm">
            Waiting for the host to start the game…
          </p>
        )}
      </div>
    </div>
  );
}
