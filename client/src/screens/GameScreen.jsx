import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { socket } from "../socket";
import { useSocketEvents } from "../hooks/useSocketEvents";
import { setHasAnswered } from "../store/gameSlice";
import CountdownTimer from "../components/CountdownTimer";
import QuestionResultOverlay from "../components/QuestionResultOverlay";
import HostControls from "../components/HostControls";

export default function GameScreen() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {
    currentQuestion,
    lastQuestionResult,
    hasAnswered,
    nickname,
    isHost,
    playState,
    roundPhase,
    phaseEndsAt,
  } =
    useSelector((s) => s.game);

  useSocketEvents(gameId);

  useEffect(() => {
    if (!nickname) {
      navigate(`/game/${gameId}/join`);
    }
  }, [nickname, gameId, navigate]);

  function handleAnswer(option) {
    if (hasAnswered || playState === "paused" || roundPhase !== "question_live") return;
    dispatch(setHasAnswered(true));
    socket.emit("answer:submit", {
      gameId,
      questionNumber: currentQuestion.questionNumber,
      answer: option,
    });
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Waiting for question…</p>
      </div>
    );
  }

  const { questionNumber, totalQuestions, question, timeLimit } = currentQuestion;
  // Key forces CountdownTimer to remount when question changes or when resumed (timeLimit updates)
  const timerKey = `${questionNumber}-${timeLimit}`;
  const answersDisabled = hasAnswered || playState === "paused" || roundPhase !== "question_live";

  return (
    <div className="relative min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6 px-4">
      {/* Paused overlay */}
      {playState === "paused" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-950/90 backdrop-blur-sm gap-4">
          <p className="text-3xl font-bold text-yellow-400">Game Paused</p>
          {isHost ? (
            <HostControls gameId={gameId} />
          ) : (
            <p className="text-gray-400 text-sm">Waiting for the host to resume…</p>
          )}
        </div>
      )}

      {lastQuestionResult && (
        <QuestionResultOverlay
          result={lastQuestionResult}
          roundPhase={roundPhase}
          phaseEndsAt={phaseEndsAt}
        />
      )}

      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Host controls (running state only) */}
        {isHost && playState === "running" && (
          <div className="flex justify-end">
            <HostControls gameId={gameId} />
          </div>
        )}

        {/* Session progress */}
        <div className="text-center">
          <p className="text-sm text-gray-400 uppercase tracking-widest">
            Question {questionNumber} of {totalQuestions}
          </p>
        </div>

        {/* Timer */}
        <CountdownTimer key={timerKey} timeLimit={timeLimit} />

        {/* Question */}
        <div className="bg-gray-800 rounded-2xl px-6 py-8 text-center">
          <p className="text-xl font-semibold leading-snug">{question.prompt}</p>
        </div>

        {/* Answer options */}
        <div className="grid grid-cols-2 gap-3">
          {question.options.map((opt) => (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              disabled={answersDisabled}
              className="py-4 px-3 rounded-xl bg-gray-700 hover:bg-indigo-600 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {opt}
            </button>
          ))}
        </div>

        {hasAnswered && !lastQuestionResult && (
          <p className="text-center text-gray-500 text-sm">
            Answer submitted. Waiting for result…
          </p>
        )}
      </div>
    </div>
  );
}
