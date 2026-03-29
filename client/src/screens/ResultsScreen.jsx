import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { resetGame } from "../store/gameSlice";
import { useSocketEvents } from "../hooks/useSocketEvents";
import FinalLeaderboard from "../components/FinalLeaderboard";
import HostPostGameControls from "../components/HostPostGameControls";

export default function ResultsScreen() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { lastRoundResults, players, isHost, endReason, genre } = useSelector((s) => s.game);

  useSocketEvents(gameId);

  // Fall back to live players if snapshot not yet set (shouldn't happen in practice)
  const resultScores = lastRoundResults?.scores ?? players;
  const sorted = [...resultScores].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const topPlayers = sorted.filter((p) => p.score === topScore);
  const isTie = topPlayers.length > 1;

  const winnerId = lastRoundResults?.winnerId ?? null;
  const winnerNickname = lastRoundResults?.winnerNickname ?? topPlayers[0]?.nickname;

  function handlePlayAgain() {
    dispatch(resetGame());
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-indigo-400">
          {endReason === "host_ended" ? "Game Ended Early" : "Game Over!"}
        </h1>
        {genre && (
          <p className="mt-1 text-indigo-300 text-sm">
            Category: <span className="font-semibold capitalize">{genre}</span>
          </p>
        )}
        {isTie || !winnerId ? (
          <p className="mt-2 text-yellow-400 font-semibold text-lg">
            {sorted.length > 0 && topScore === 0 ? "No winner" : "It's a tie!"}
          </p>
        ) : (
          <p className="mt-2 text-green-400 font-semibold text-lg">
            {winnerNickname} wins!
          </p>
        )}
      </div>

      <div className="w-full max-w-sm">
        <FinalLeaderboard players={resultScores} />
      </div>

      {/* Current room roster (updates in real-time as players join) */}
      {players.length !== resultScores.length && (
        <div className="w-full max-w-sm text-sm text-gray-500 text-center">
          {players.length - resultScores.length > 0
            ? `+${players.length - resultScores.length} player(s) joined after the round`
            : null}
        </div>
      )}

      {isHost ? (
        <HostPostGameControls gameId={gameId} />
      ) : (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <p className="text-center text-gray-500 text-sm">
            Waiting for host to start next round…
          </p>
          <button
            onClick={handlePlayAgain}
            className="w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold text-lg transition"
          >
            Leave Game
          </button>
        </div>
      )}
    </div>
  );
}
