import { useEffect, useMemo, useState } from "react";
import MiniLeaderboard from "./MiniLeaderboard";

const DEFAULT_HYPE_DURATION_MS = 3000;

function getSafePhaseStartedAt(phaseStartedAt, phaseEndsAt) {
  return Number.isFinite(phaseStartedAt)
    ? phaseStartedAt
    : phaseEndsAt - DEFAULT_HYPE_DURATION_MS;
}

function getCountdownStart(phaseStartedAt, phaseEndsAt) {
  if (!Number.isFinite(phaseEndsAt)) {
    return 0;
  }

  const safePhaseStartedAt = getSafePhaseStartedAt(phaseStartedAt, phaseEndsAt);
  const durationMs = Math.max(1000, phaseEndsAt - safePhaseStartedAt);

  return Math.max(1, Math.ceil(durationMs / 1000));
}

function getCountdownValue({ roundPhase, phaseStartedAt, phaseEndsAt, now }) {
  if (roundPhase !== "question_hype" || !Number.isFinite(phaseEndsAt)) {
    return 0;
  }

  if (now >= phaseEndsAt) {
    return 0;
  }

  const countdownStart = getCountdownStart(phaseStartedAt, phaseEndsAt);
  const safePhaseStartedAt = getSafePhaseStartedAt(phaseStartedAt, phaseEndsAt);
  const elapsedMs = Math.max(0, now - safePhaseStartedAt);
  const elapsedWholeSeconds = Math.floor(elapsedMs / 1000);

  return Math.max(1, countdownStart - elapsedWholeSeconds);
}

export default function QuestionResultOverlay({
  result,
  roundPhase,
  phaseStartedAt,
  phaseEndsAt,
  previousScores = [],
}) {
  const { winnerNickname, correctAnswer, scores } = result;
  const [countdown, setCountdown] = useState(0);
  const countdownStart = useMemo(
    () => getCountdownStart(phaseStartedAt, phaseEndsAt),
    [phaseStartedAt, phaseEndsAt],
  );
  const countdownSequence = useMemo(
    () =>
      Array.from(
        { length: countdownStart },
        (_, index) => countdownStart - index,
      ),
    [countdownStart],
  );

  useEffect(() => {
    if (roundPhase !== "question_hype" || !phaseEndsAt) {
      setCountdown(0);
      return;
    }

    const updateCountdown = () => {
      setCountdown(
        getCountdownValue({
          roundPhase,
          phaseStartedAt,
          phaseEndsAt,
          now: Date.now(),
        }),
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => clearInterval(interval);
  }, [roundPhase, phaseStartedAt, phaseEndsAt]);

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
            <p className="text-indigo-300 text-lg font-semibold">Get ready...</p>
            <div
              className="question-result-overlay__countdown-steps mt-3"
              aria-hidden="true"
            >
              {countdownSequence.map((value) => {
                const stepState =
                  countdown === value
                    ? "active"
                    : countdown > 0 && countdown < value
                      ? "pending"
                      : "complete";

                return (
                  <span
                    key={value}
                    className="question-result-overlay__countdown-step"
                    data-step-state={stepState}
                  >
                    {value}
                  </span>
                );
              })}
            </div>
            <p
              key={countdown > 0 ? countdown : "go"}
              className="question-result-overlay__countdown text-8xl font-extrabold tracking-tight text-white mt-3"
              data-countdown-value={countdown > 0 ? countdown : "GO"}
              data-testid="hype-countdown-display"
              aria-live="assertive"
              aria-atomic="true"
            >
              {countdown > 0 ? countdown : "Go!"}
            </p>
          </div>
        ) : (
          <p className="question-result-overlay__next-step mt-6 text-center text-gray-500 text-sm">
            Next question coming up...
          </p>
        )}
      </div>
    </div>
  );
}
