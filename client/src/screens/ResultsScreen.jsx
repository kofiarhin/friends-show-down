import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
import { resetGame } from "../store/gameSlice";
import { useSocketEvents } from "../hooks/useSocketEvents";
import FinalLeaderboard from "../components/FinalLeaderboard";
import HostPostGameControls from "../components/HostPostGameControls";
import ChatPanel from "../components/ChatPanel";

export default function ResultsScreen() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {
    playerId,
    lastRoundResults,
    players,
    isHost,
    endReason,
    genre,
    chatMessages,
    chatError,
  } = useSelector((s) => s.game);

  useSocketEvents(gameId);

  // Fall back to live players if snapshot not yet set (shouldn't happen in practice)
  const resultScores = lastRoundResults?.scores ?? players;
  const sorted = [...resultScores].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const topPlayers = sorted.filter((p) => p.score === topScore);
  const isTie = topPlayers.length > 1;

  const winnerId = lastRoundResults?.winnerId ?? null;
  const winnerNickname =
    lastRoundResults?.winnerNickname ?? topPlayers[0]?.nickname;
  const topScorer = sorted[0] ?? null;
  const showCelebration =
    !!winnerId && !isTie && endReason !== "host_ended" && topScore > 0;

  function handlePlayAgain() {
    dispatch(resetGame());
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-8 px-4 py-10 relative overflow-hidden">
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

      {showCelebration && (
        <div className="results-confetti" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <span
              key={index}
              className={`confetti-piece confetti-piece-${index + 1}`}
            />
          ))}
        </div>
      )}

      <div className="w-full max-w-6xl grid gap-6 md:grid-cols-[1.8fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
              Final summary
            </p>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-400">Top scorer</p>
                <p className="text-2xl font-semibold text-white">
                  {topScorer?.nickname ?? "No scorer"}
                </p>
              </div>
              <div className="rounded-full bg-indigo-600 px-3 py-1 text-sm font-semibold">
                {topScore} pts
              </div>
            </div>
            {isTie && topPlayers.length > 1 && (
              <p className="mt-3 text-sm text-yellow-300">
                Shared victory for {topPlayers.length} players.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
            <FinalLeaderboard players={resultScores} />
          </div>

          {players.length !== resultScores.length && (
            <div className="text-sm text-gray-500 text-center">
              {players.length - resultScores.length > 0
                ? `+${players.length - resultScores.length} player(s) joined after the round`
                : null}
            </div>
          )}

          {isHost ? (
            <HostPostGameControls gameId={gameId} genre={genre} />
          ) : (
            <div className="flex flex-col items-center gap-4 w-full">
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

        <div className="flex flex-col gap-6">
          <ChatPanel
            enabled={true}
            title="Post-game chat"
            currentUserId={playerId}
            messages={chatMessages}
            error={chatError}
            onSend={(message) => socket.emit("chat:send", { gameId, message })}
            placeholder="Share your final thoughts..."
          />
        </div>
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
        <HostPostGameControls gameId={gameId} genre={genre} />
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
