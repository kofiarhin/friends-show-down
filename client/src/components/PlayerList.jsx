export default function PlayerList({ players }) {
  return (
    <ul className="flex flex-col gap-2 w-full">
      {players.map((p) => (
        <li
          key={p.playerId}
          className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gray-800"
        >
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              p.connected ? "bg-green-400" : "bg-gray-600"
            }`}
          />
          <span className={p.connected ? "text-white" : "text-gray-500"}>
            {p.nickname}
          </span>
        </li>
      ))}
    </ul>
  );
}
