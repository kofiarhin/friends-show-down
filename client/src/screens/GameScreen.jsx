import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { socket } from "../socket";
import { useSocketEvents } from "../hooks/useSocketEvents";
import { setHasAnswered, clearChatError } from "../store/gameSlice";
import CountdownTimer from "../components/CountdownTimer";
import QuestionResultOverlay from "../components/QuestionResultOverlay";
import HostControls from "../components/HostControls";
import ChatDrawer from "../components/ChatDrawer";

export default function GameScreen() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {
    playerId,
    status,
    currentQuestion,
    lastQuestionResult,
    hasAnswered,
    nickname,
    isHost,
    players,
    playState,
    roundPhase,
    phaseEndsAt,
    chatMessages,
    chatError,
  } = useSelector((s) => s.game);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [pauseOverlayVisible, setPauseOverlayVisible] = useState(
    playState === "paused",
  );
  const previousScoresRef = useRef(players);

  useSocketEvents(gameId);

  useEffect(() => {
    if (!nickname) {
      navigate(`/game/${gameId}/join`);
    }
  }, [nickname, gameId, navigate]);

  useEffect(() => {
    if (!currentQuestion) return;
    setSelectedAnswer(null);
  }, [currentQuestion?.questionNumber]);

  useEffect(() => {
    if (playState === "paused") {
      setPauseOverlayVisible(true);
      return;
    }

    if (!pauseOverlayVisible) return;

    const timeout = setTimeout(() => {
      setPauseOverlayVisible(false);
    }, 180);

    return () => clearTimeout(timeout);
  }, [playState, pauseOverlayVisible]);

  useEffect(() => {
    if (!lastQuestionResult) {
      previousScoresRef.current = players;
    }
  }, [players, lastQuestionResult]);

  function handleAnswer(option) {
    if (
      hasAnswered ||
      playState === "paused" ||
      roundPhase !== "question_live"
    ) {
      return;
    }

    setSelectedAnswer(option);
    dispatch(setHasAnswered(true));
    socket.emit("answer:submit", {
      gameId,
      questionNumber: currentQuestion.questionNumber,
      answer: option,
    });
  }

  const chatEnabled =
    status === "waiting" ||
    status === "ended" ||
    (status === "in-progress" && roundPhase !== "question_live");

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Waiting for question…</p>
      </div>
    );
  }

  const { questionNumber, totalQuestions, question, timeLimit } =
    currentQuestion;
  const timerKey = `${questionNumber}-${timeLimit}`;
  const questionKey = `${questionNumber}`;
  const answersDisabled =
    hasAnswered || playState === "paused" || roundPhase !== "question_live";
  const isPauseOverlayActive = playState === "paused";

  return (
    <div className="gameplay-shell relative min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6 px-4">
      {pauseOverlayVisible && (
        <div
          className="pause-overlay absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950/90 backdrop-blur-sm gap-4"
          data-visible={isPauseOverlayActive}
          data-testid="pause-overlay"
        >
          <p className="text-3xl font-bold text-yellow-400">Game Paused</p>
          {isHost ? (
            <HostControls gameId={gameId} />
          ) : (
            <p className="text-gray-400 text-sm">
              Waiting for the host to resume…
            </p>
          )}
        </div>
      )}

      {lastQuestionResult && (
        <QuestionResultOverlay
          result={lastQuestionResult}
          roundPhase={roundPhase}
          phaseEndsAt={phaseEndsAt}
          previousScores={previousScoresRef.current}
        />
      )}

      <div className="w-full max-w-6xl grid gap-6 md:grid-cols-[1.8fr_1fr]">
        <div
          className="gameplay-content w-full flex flex-col gap-6"
          data-paused={isPauseOverlayActive}
        >
          {isHost && playState === "running" && (
            <div className="flex justify-end">
              <HostControls gameId={gameId} />
            </div>
          )}

          <div key={questionKey} className="question-stage flex flex-col gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-400 uppercase tracking-widest">
                Question {questionNumber} of {totalQuestions}
              </p>
            </div>

            <CountdownTimer key={timerKey} timeLimit={timeLimit} />

            <div className="question-card bg-gray-800 rounded-2xl px-6 py-8 text-center">
              <p className="text-xl font-semibold leading-snug">
                {question.prompt}
              </p>
            </div>

            <div className="answer-grid grid grid-cols-2 gap-3">
              {question.options.map((opt, index) => {
                const answerState =
                  selectedAnswer === opt
                    ? "selected"
                    : hasAnswered
                      ? "locked"
                      : "idle";

                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    disabled={answersDisabled}
                    data-answer-state={answerState}
                    data-question-live={roundPhase === "question_live"}
                    className="game-answer-button py-4 px-3 rounded-xl bg-gray-700 hover:bg-indigo-600 font-medium text-sm disabled:cursor-not-allowed"
                    style={{ "--answer-index": index }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {hasAnswered && !lastQuestionResult && (
            <p className="text-center text-gray-500 text-sm">
              Answer submitted. Waiting for result…
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <ChatDrawer
          enabled={chatEnabled}
          title="Game chat"
          currentUserId={playerId}
          messages={chatMessages}
          error={chatError}
          onSend={(message) => {
            dispatch(clearChatError());
            socket.emit("chat:send", { gameId, message });
          }}
          placeholder={
            status === "in-progress"
              ? "Chat opens between questions..."
              : "Say hello to the lobby!"
          }
        />
      </div>
    </div>
  );
}
