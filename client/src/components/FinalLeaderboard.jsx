export default function FinalLeaderboard({ players }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;

  let rank = 1;
  const ranked = sorted.map((p, i) => {
    if (i > 0 && sorted[i - 1].score > p.score) rank = i + 1;
    return { ...p, rank };
  });

  return (
    <div className="flex flex-col gap-2 w-full">
      {ranked.map((p) => (
        <div
          key={p.playerId}
          className={`flex items-center gap-4 px-4 py-3 rounded-xl ${
            p.score === topScore
              ? "bg-indigo-900/60 border border-indigo-600"
              : "bg-gray-800"
          }`}
        >
          <span className="text-gray-400 font-mono w-6 text-sm">
            #{p.rank}
          </span>
          <span className="flex-1 font-semibold">{p.nickname}</span>
          <span className="font-bold text-indigo-300">{p.score} pts</span>
        </div>
      ))}
    </div>
  );
}
