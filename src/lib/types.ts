export type GameStatus = "upcoming" | "live" | "final";

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
