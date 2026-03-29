import { useState } from "react";
import { socket } from "../socket";
import ShareLink from "./ShareLink";

const GENRES = [
  { slug: "mixed", label: "Mixed" },
  { slug: "science", label: "Science" },
  { slug: "geography", label: "Geography" },
  { slug: "history", label: "History" },
  { slug: "politics", label: "Politics" },
  { slug: "sports", label: "Sports" },
  { slug: "entertainment", label: "Entertainment" },
];

export default function HostPostGameControls({ gameId, genre }) {
  const [showInvite, setShowInvite] = useState(false);
  const [showGenreSelector, setShowGenreSelector] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState(null);

  function handleRestart() {
    socket.emit("game:restart", { gameId });
  }

  function handleCloseRoom() {
    if (!window.confirm("Close the room? Everyone will be sent home.")) return;
    socket.emit("game:close-room", { gameId });
  }

  function handleConfirmGenre() {
    if (!selectedGenre) return;
    socket.emit("room:set-genre", { gameId, genre: selectedGenre });
    setShowGenreSelector(false);
    setSelectedGenre(null);
  }

  return (
    <div className="w-full max-w-sm flex flex-col gap-3">
      <button
        onClick={handleRestart}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-lg transition"
      >
        Restart Round
      </button>

      {!showGenreSelector ? (
        <button
          onClick={() => setShowGenreSelector(true)}
          className="w-full py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm font-medium transition"
        >
          Change Category{genre ? ` (${genre.charAt(0).toUpperCase() + genre.slice(1)})` : ""}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-400 text-center">Choose a new category</p>
          <div className="grid grid-cols-2 gap-2">
            {GENRES.map(({ slug, label }) => (
              <button
                key={slug}
                onClick={() => setSelectedGenre(slug)}
                className={`py-2.5 rounded-xl font-semibold text-sm transition border ${
                  selectedGenre === slug
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : slug === genre && !selectedGenre
                    ? "bg-gray-700 border-indigo-800 text-gray-300"
                    : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={handleConfirmGenre}
            disabled={!selectedGenre}
            className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Confirm
          </button>
          <button
            onClick={() => { setShowGenreSelector(false); setSelectedGenre(null); }}
            className="w-full py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
        </div>
      )}

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
