import { useEffect, useState } from "react";

export default function CountdownTimer({ timeLimit, startedAt }) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  useEffect(() => {
    setTimeLeft(timeLimit);
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLimit, startedAt]);

  const pct = (timeLeft / timeLimit) * 100;
  const color =
    pct > 50 ? "bg-green-500" : pct > 25 ? "bg-yellow-400" : "bg-red-500";

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-gray-400 mb-1">
        <span>Time</span>
        <span className="font-mono font-semibold text-white">{timeLeft}s</span>
      </div>
      <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
