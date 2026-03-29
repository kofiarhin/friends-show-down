import { useEffect, useMemo, useState } from "react";

function sortScores(scores) {
  return [...scores].sort((a, b) => b.score - a.score);
}

function buildRankMap(scores) {
  return sortScores(scores).reduce((map, player, index) => {
    map.set(player.playerId, index + 1);
    return map;
  }, new Map());
}

export default function MiniLeaderboard({
  scores = [],
  previousScores = [],
}) {
  const sorted = useMemo(() => sortScores(scores), [scores]);
  const previousScoreMap = useMemo(
    () =>
      previousScores.reduce((map, player) => {
        map.set(player.playerId, player.score);
        return map;
      }, new Map()),
    [previousScores],
  );
  const previousRankMap = useMemo(
    () => buildRankMap(previousScores),
    [previousScores],
  );
  const [highlightedIds, setHighlightedIds] = useState([]);

  useEffect(() => {
    if (!scores.length || !previousScores.length) {
      setHighlightedIds([]);
      return;
    }

    const changedIds = sorted
      .filter((player, index) => {
        const previousScore = previousScoreMap.get(player.playerId);
        const previousRank = previousRankMap.get(player.playerId);

        if (previousScore === undefined && previousRank === undefined) {
          return false;
        }

        return previousScore !== player.score || previousRank !== index + 1;
      })
      .map((player) => player.playerId);

    setHighlightedIds(changedIds);

    if (!changedIds.length) return;

    const timeout = setTimeout(() => {
      setHighlightedIds([]);
    }, 1600);

    return () => clearTimeout(timeout);
  }, [scores, previousScores, sorted, previousScoreMap, previousRankMap]);

  return (
    <div className="flex flex-col gap-1 w-full">
      {sorted.map((player, index) => {
        const previousScore = previousScoreMap.get(player.playerId);
        const previousRank = previousRankMap.get(player.playerId);
        const scoreChanged =
          previousScore !== undefined && previousScore !== player.score;
        const rankChanged =
          previousRank !== undefined && previousRank !== index + 1;
        const highlighted = highlightedIds.includes(player.playerId);

        return (
          <div
            key={player.playerId}
            className="mini-leaderboard__row flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-700 text-sm"
            data-highlighted={highlighted}
            data-rank-changed={rankChanged}
            data-score-changed={scoreChanged}
            style={{ "--leaderboard-index": index }}
          >
            <span className="text-gray-400 w-5">#{index + 1}</span>
            <span className="flex-1 text-white truncate pr-3">{player.nickname}</span>
            <span className="mini-leaderboard__score font-bold text-indigo-300">
              {player.score} pts
            </span>
          </div>
        );
      })}
    </div>
  );
}
