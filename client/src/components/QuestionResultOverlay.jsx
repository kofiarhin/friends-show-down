import MiniLeaderboard from "./MiniLeaderboard";

export default function QuestionResultOverlay({ result }) {
  const { winnerNickname, correctAnswer, scores } = result;

  return (
    <div className="absolute inset-0 bg-gray-950/90 flex flex-col items-center justify-center gap-6 px-4 z-10">
      <div className="text-center">
        {winnerNickname ? (
          <>
            <p className="text-2xl font-bold text-green-400">
              {winnerNickname} got it!
            </p>
            <p className="text-gray-400 mt-1">
              Correct answer:{" "}
              <span className="text-white font-semibold">{correctAnswer}</span>
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-red-400">No one got it!</p>
            <p className="text-gray-400 mt-1">
              Correct answer:{" "}
              <span className="text-white font-semibold">{correctAnswer}</span>
            </p>
          </>
        )}
      </div>

      <div className="w-full max-w-xs">
        <p className="text-sm text-gray-400 mb-2">Scores</p>
        <MiniLeaderboard scores={scores} />
      </div>

      <p className="text-gray-500 text-sm">Next question coming up…</p>
    </div>
  );
}
