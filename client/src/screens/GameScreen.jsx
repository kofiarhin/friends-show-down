import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { socket } from "../socket";
import { useSocketEvents } from "../hooks/useSocketEvents";
import { setHasAnswered } from "../store/gameSlice";
import CountdownTimer from "../components/CountdownTimer";
import QuestionResultOverlay from "../components/QuestionResultOverlay";

export default function GameScreen() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentQuestion, lastQuestionResult, hasAnswered, nickname } =
    useSelector((s) => s.game);

  const startedAtRef = useRef(Date.now());

  useSocketEvents(gameId);

  // Guard: must have a question
  useEffect(() => {
    if (!nickname) {
      navigate(`/game/${gameId}/join`);
    }
  }, [nickname, gameId, navigate]);

  // Reset startedAt ref when question changes
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, [currentQuestion?.questionNumber]);

  function handleAnswer(option) {
    if (hasAnswered) return;
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

  return (
    <div className="relative min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6 px-4">
      {lastQuestionResult && (
        <QuestionResultOverlay result={lastQuestionResult} />
      )}

      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Session progress */}
        <div className="text-center">
          <p className="text-sm text-gray-400 uppercase tracking-widest">
            Question {questionNumber} of {totalQuestions}
          </p>
        </div>

        {/* Timer */}
        <CountdownTimer
          timeLimit={timeLimit}
          startedAt={startedAtRef.current}
        />

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
              disabled={hasAnswered}
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
