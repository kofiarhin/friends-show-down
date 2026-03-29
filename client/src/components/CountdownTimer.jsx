import { useEffect, useState } from "react";

function getUrgencyLevel(timeLeft) {
  if (timeLeft <= 3) return "critical";
  if (timeLeft <= 5) return "urgent";
  return "normal";
}

export default function CountdownTimer({ timeLimit }) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  useEffect(() => {
    setTimeLeft(timeLimit);

    const interval = setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          clearInterval(interval);
          return 0;
        }

        return value - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLimit]);

  const safeTimeLimit = Math.max(timeLimit, 1);
  const pct = (timeLeft / safeTimeLimit) * 100;
  const color =
    pct > 50 ? "bg-green-500" : pct > 25 ? "bg-yellow-400" : "bg-red-500";
  const urgency = getUrgencyLevel(timeLeft);

  return (
    <div
      className="countdown-timer w-full"
      data-testid="countdown-timer"
      data-urgency={urgency}
      data-time-left={timeLeft}
    >
      <div className="flex justify-between text-sm text-gray-400 mb-1">
        <span>Time</span>
        <span className="countdown-timer__value font-mono font-semibold text-white">
          {timeLeft}s
        </span>
      </div>
      <div className="countdown-timer__track w-full h-2 rounded-full bg-gray-700 overflow-hidden">
        <div
          className={`countdown-timer__fill h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
