import { useState } from "react";
import { socket } from "../socket";
import ShareLink from "./ShareLink";

export default function HostPostGameControls({ gameId }) {
  const [showInvite, setShowInvite] = useState(false);

  function handleRestart() {
    socket.emit("game:restart", { gameId });
  }

  function handleCloseRoom() {
    if (!window.confirm("Close the room? Everyone will be sent home.")) return;
    socket.emit("game:close-room", { gameId });
  }

  return (
    <div className="w-full max-w-sm flex flex-col gap-3">
      <button
        onClick={handleRestart}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-lg transition"
      >
        Restart Round
      </button>
      <button
        onClick={() => setShowInvite((v) => !v)}
        className="w-full py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm font-medium transition"
      >
        {showInvite ? "Hide Invite Link" : "Invite Player"}
      </button>
      {showInvite && <ShareLink gameId={gameId} />}
      <button
        onClick={handleCloseRoom}
        className="w-full py-2 rounded-xl bg-gray-800 hover:bg-red-900 text-sm text-gray-400 hover:text-white transition"
      >
        Close Room
      </button>
    </div>
  );
}
