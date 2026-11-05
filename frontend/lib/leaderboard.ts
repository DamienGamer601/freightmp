import { getApiUrl } from "./api";

export type LeaderboardMetric = "km" | "deliveries";

export interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  avatarUrl: string | null;
  country: string | null;
  role: string;
  kilometersDriven: number;
  deliveriesCompleted: number;
  totalPlayTimeSeconds: number;
  level: number;
}

export interface LeaderboardResponse {
  metric: LeaderboardMetric;
  entries: LeaderboardEntry[];
}

export async function fetchLeaderboard(
  metric: LeaderboardMetric = "km",
): Promise<LeaderboardResponse> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/leaderboard?metric=${metric}&limit=50`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error(`Statut HTTP ${res.status}`);
  }

  return (await res.json()) as LeaderboardResponse;
}
