import { useSelector } from "react-redux";
import { socket } from "../socket";

export default function HostControls({ gameId }) {
  const { playState, questionAnswered } = useSelector((s) => s.game);

  function handlePause() {
    socket.emit("game:pause", { gameId });
  }

  function handleResume() {
    socket.emit("game:resume", { gameId });
  }

  function handleEndGame() {
    if (!window.confirm("End the game now? Players will go to results.")) return;
    socket.emit("game:end-early", { gameId });
  }

  return (
    <div className="flex items-center gap-2">
      {playState === "running" ? (
        <button
          onClick={handlePause}
          disabled={questionAnswered}
          className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Pause
        </button>
      ) : (
        <button
          onClick={handleResume}
          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium transition"
        >
          Resume
        </button>
      )}
      <button
        onClick={handleEndGame}
        className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-sm font-medium transition"
      >
        End Game
      </button>
    </div>
  );
}
