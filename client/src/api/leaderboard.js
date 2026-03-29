import { apiBase } from "../config";

export async function fetchWeeklyLeaderboard(weekId) {
  const url = weekId
    ? `${apiBase}/api/leaderboard/weekly/${encodeURIComponent(weekId)}`
    : `${apiBase}/api/leaderboard/weekly`;

  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.message || "Failed to load leaderboard.");
    error.status = res.status;
    throw error;
  }

  return res.json();
}
