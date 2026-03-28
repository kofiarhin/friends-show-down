export default function MiniLeaderboard({ scores }) {
  const sorted = [...scores].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col gap-1 w-full">
      {sorted.map((p, i) => (
        <div
          key={p.playerId}
          className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-700 text-sm"
        >
          <span className="text-gray-400 w-5">#{i + 1}</span>
          <span className="flex-1 text-white">{p.nickname}</span>
          <span className="font-bold text-indigo-300">{p.score} pts</span>
        </div>
      ))}
    </div>
  );
}
