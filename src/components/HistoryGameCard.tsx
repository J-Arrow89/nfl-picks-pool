import TeamBadge from "./TeamBadge";
import type { Game, Pick, Profile } from "@/lib/types";

// Read-only version of GameCard for past weeks — no pick buttons, no lock
// countdown, just the final score, game leaders, and everyone's picks with
// a ✓/✗ next to each since the outcome is already known.
export default function HistoryGameCard({
  game,
  picks,
  profiles,
}: {
  game: Game;
  picks: Pick[];
  profiles: Profile[];
}) {
  const kickoff = new Date(game.kickoff_time);
  const kickoffLabel = kickoff.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const actualWinner =
    game.home_score !== null && game.away_score !== null
      ? game.home_score > game.away_score
        ? game.home_team
        : game.away_score > game.home_score
          ? game.away_team
          : null
      : null;

  const total =
    game.home_score !== null && game.away_score !== null
      ? game.home_score + game.away_score
      : null;

  const actualOu =
    total !== null && game.total_line !== null
      ? total > game.total_line
        ? "Over"
        : total < game.total_line
          ? "Under"
          : null
      : null;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400">{kickoffLabel}</span>
        <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-300">
          {game.status === "final" ? "Final" : game.status}
        </span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col items-center gap-1 w-24">
          <TeamBadge team={game.away_team} />
          <span className="text-xs text-slate-200 text-center leading-tight">
            {game.away_team}
          </span>
          {game.away_score !== null && (
            <span className="text-lg font-bold text-white">{game.away_score}</span>
          )}
        </div>
        <span className="text-slate-500 text-sm font-medium">@</span>
        <div className="flex flex-col items-center gap-1 w-24">
          <TeamBadge team={game.home_team} />
          <span className="text-xs text-slate-200 text-center leading-tight">
            {game.home_team}
          </span>
          {game.home_score !== null && (
            <span className="text-lg font-bold text-white">{game.home_score}</span>
          )}
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 mb-3">
        Total: <span className="text-slate-200 font-semibold">{game.total_line ?? "TBD"}</span>
        {actualOu && <span className="text-slate-500"> · went {actualOu}</span>}
      </div>

      <div className="border-t border-slate-800 pt-2 mt-1 space-y-1">
        {profiles.map((p) => {
          const pick = picks.find((pk) => pk.player_id === p.id);
          const winnerRight = !!(
            pick?.winner_pick && actualWinner && pick.winner_pick === actualWinner
          );
          const ouRight = !!(pick?.ou_pick && actualOu && pick.ou_pick === actualOu);
          return (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{p.display_name}</span>
              {pick ? (
                <span className="text-slate-200">
                  <span className={winnerRight ? "text-emerald-400" : "text-slate-200"}>
                    {pick.winner_pick ?? "—"}
                  </span>{" "}
                  ·{" "}
                  <span className={ouRight ? "text-emerald-400" : "text-slate-200"}>
                    {pick.ou_pick ?? "—"}
                  </span>
                </span>
              ) : (
                <span className="text-slate-600 italic">no pick</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
