import MiniLeaderboard from "./MiniLeaderboard";
import { useEffect, useState } from "react";

export default function QuestionResultOverlay({ result, roundPhase, phaseEndsAt }) {
  const { winnerNickname, correctAnswer, scores } = result;
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (roundPhase !== "question_hype" || !phaseEndsAt) {
      setCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remainingMs = Math.max(0, phaseEndsAt - Date.now());
      setCountdown(Math.max(1, Math.ceil(remainingMs / 1000)));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);
    return () => clearInterval(interval);
  }, [roundPhase, phaseEndsAt]);

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

      {roundPhase === "question_hype" ? (
        <div className="text-center">
          <p className="text-indigo-300 text-lg font-semibold">Get ready…</p>
          <p className="text-4xl font-black text-white mt-1">{countdown}</p>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">Next question coming up…</p>
      )}
    </div>
  );
}
