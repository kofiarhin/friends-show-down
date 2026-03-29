import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchWeeklyLeaderboard } from "../api/leaderboard";

export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState(null);
  const [weekIdInput, setWeekIdInput] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard(weekId) {
    setStatus("loading");
    setError(null);

    try {
      const data = await fetchWeeklyLeaderboard(weekId);
      setLeaderboard(data);
      setStatus("success");
    } catch (err) {
      setLeaderboard(null);
      setStatus("error");
      setError(err.message || "Unable to load leaderboard.");
    }
  }

  const headline = useMemo(() => {
    if (status === "loading") return "Loading leaderboard...";
    if (status === "error") return "Unable to load leaderboard";

    if (!leaderboard) return "Weekly leaderboard";
    return leaderboard.entries.length
      ? `Weekly leaderboard — ${leaderboard.weekId}`
      : `No completed games for ${leaderboard.weekId}`;
  }, [status, leaderboard]);

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-4xl font-extrabold text-indigo-400">
                Weekly leaderboard
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                See current weekly standings or look up a past week by ID.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Back to home
            </Link>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              loadLeaderboard(weekIdInput.trim() || undefined);
            }}
            className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="sr-only" htmlFor="week-id-input">
              Week ID
            </label>
            <div className="min-w-0 flex-1">
              <input
                id="week-id-input"
                type="text"
                value={weekIdInput}
                onChange={(event) => setWeekIdInput(event.target.value)}
                placeholder="Enter week ID (e.g. 2026-13)"
                className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-2 text-xs text-slate-500">
                Leave blank to load the current week.
              </p>
            </div>
            <button
              type="submit"
              className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Load leaderboard
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">{headline}</h2>
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            </div>
            {status === "success" && leaderboard?.weekId && (
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-400">
                {leaderboard.weekId}
              </span>
            )}
          </div>

          {status === "loading" ? (
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-10 text-center text-slate-400">
              Loading leaderboard...
            </div>
          ) : status === "error" ? (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-10 text-center text-red-300">
              {error}
            </div>
          ) : leaderboard?.entries?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="pb-3 pr-6">Rank</th>
                    <th className="pb-3 pr-6">Player</th>
                    <th className="pb-3 pr-6">Score</th>
                    <th className="pb-3 pr-6">Wins</th>
                    <th className="pb-3 pr-6">Games</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.entries.map((entry) => (
                    <tr
                      key={`${entry.playerName}-${entry.rank}-${entry.score}`}
                      className="border-t border-white/10"
                    >
                      <td className="py-4 pr-6 font-semibold text-white">
                        {entry.rank}
                      </td>
                      <td className="py-4 pr-6 text-slate-100">
                        {entry.playerName}
                      </td>
                      <td className="py-4 pr-6 text-slate-200">
                        {entry.score}
                      </td>
                      <td className="py-4 pr-6 text-slate-200">{entry.wins}</td>
                      <td className="py-4 pr-6 text-slate-200">
                        {entry.gamesPlayed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-10 text-center text-slate-400">
              No leaderboard data is available for this week.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
