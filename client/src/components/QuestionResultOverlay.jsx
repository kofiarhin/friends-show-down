import { useEffect, useState } from "react";
import MiniLeaderboard from "./MiniLeaderboard";

export default function QuestionResultOverlay({
  result,
  roundPhase,
  phaseEndsAt,
  previousScores = [],
}) {
  const { winnerNickname, correctAnswer, scores } = result;
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (roundPhase !== "question_hype" || !phaseEndsAt) {
      setCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remainingMs = Math.max(0, phaseEndsAt - Date.now());
      setCountdown(Math.ceil(remainingMs / 1000));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => clearInterval(interval);
  }, [roundPhase, phaseEndsAt]);

  return (
    <div
      className="question-result-overlay absolute inset-0 z-10 flex items-center justify-center px-4"
      data-overlay-phase={roundPhase ?? "question_result"}
    >
      <div className="question-result-overlay__panel w-full max-w-md rounded-3xl border border-white/10 bg-gray-950/92 px-6 py-8 backdrop-blur-md shadow-2xl">
        <div className="question-result-overlay__copy text-center">
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

        <div className="question-result-overlay__scores w-full max-w-xs mx-auto mt-6">
          <p className="text-sm text-gray-400 mb-2">Scores</p>
          <MiniLeaderboard scores={scores} previousScores={previousScores} />
        </div>

        {roundPhase === "question_hype" ? (
          <div className="question-result-overlay__countdown-wrapper mt-6 text-center">
            <p className="text-indigo-300 text-lg font-semibold">Get ready…</p>
            <p
              key={countdown}
              className="question-result-overlay__countdown text-8xl font-extrabold tracking-tight text-white mt-1"
              data-countdown-value={countdown}
            >
              {countdown}
            </p>
          </div>
        ) : (
          <p className="question-result-overlay__next-step mt-6 text-center text-gray-500 text-sm">
            Next question coming up…
          </p>
        )}
      </div>
    </div>
  );
}
