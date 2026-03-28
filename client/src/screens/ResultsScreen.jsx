import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { resetGame } from "../store/gameSlice";
import FinalLeaderboard from "../components/FinalLeaderboard";

export default function ResultsScreen() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { players } = useSelector((s) => s.game);

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const topPlayers = sorted.filter((p) => p.score === topScore);
  const isTie = topPlayers.length > 1;

  function handlePlayAgain() {
    dispatch(resetGame());
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-indigo-400">
          Game Over!
        </h1>
        {isTie ? (
          <p className="mt-2 text-yellow-400 font-semibold text-lg">
            It&apos;s a tie!
          </p>
        ) : (
          <p className="mt-2 text-green-400 font-semibold text-lg">
            {topPlayers[0]?.nickname} wins!
          </p>
        )}
      </div>

      <div className="w-full max-w-sm">
        <FinalLeaderboard players={players} />
      </div>

      <button
        onClick={handlePlayAgain}
        className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-lg transition"
      >
        Play Again
      </button>
    </div>
  );
}
