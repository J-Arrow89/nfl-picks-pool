export type GameStatus = "upcoming" | "live" | "final";

// One player's full box-score stat line in a single category, pulled from
// ESPN's per-game boxscore (not just the lightweight scoreboard summary).
// The week-level "Top Performers" view (WeeklyTopPerformers.tsx) flattens
// every game's arrays together and picks the highest `value` per category
// across the whole week.
//
// `value` is the ranking metric for that category — Adjusted QBR (falling
// back to Passer Rating on the rare game where QBR isn't calculated) for
// passing, since raw passing yards rewards garbage-time volume over
// actual quality; rushing/receiving yards for the other two, which is a
// fine metric as-is.
//
// `passing` holds every quarterback who threw a pass in the game (both
// teams) — needed because the week's best-QBR passer isn't always the
// game's top-yardage passer, so every candidate has to be captured to
// rank correctly. `rushing`/`receiving` hold each team's single leader,
// since yards-based ranking only needs the per-game top to be exact.
export type GameLeader = {
  name: string;
  team: string;
  value: number;
  line: string; // full box-score row, e.g. "28/53, 312 YDS, 2 TD, 1 INT, QBR 43.2, RTG 75.4"
};

export type GameLeaders = {
  passing: GameLeader[];
  rushing: GameLeader[];
  receiving: GameLeader[];
};

export type Game = {
  id: number;
  week: number;
  kickoff_time: string;
  away_team: string;
  home_team: string;
  total_line: number | null;
  away_score: number | null;
  home_score: number | null;
  status: GameStatus;
  leaders: GameLeaders | null;
};

export type Profile = {
  id: string;
  display_name: string;
};

export type Pick = {
  id: number;
  game_id: number;
  player_id: string;
  winner_pick: string | null;
  ou_pick: "Over" | "Under" | null;
};
