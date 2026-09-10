import type { Game, Pick, Profile } from "@/lib/types";

type PlayerResult = { id: string; name: string; correct: number; possible: number };

// Same scoring rule as the `standings` SQL view (schema.sql) — +1 for a
// correct winner pick, +1 for a correct Over/Under pick — just scoped to
// one week's games instead of the whole season.
function computeWeeklyResults(games: Game[], picks: Pick[], profiles: Profile[]): PlayerResult[] {
  return profiles
    .map((p) => {
      let correct = 0;
      let possible = 0;
      for (const g of games) {
        if (g.status !== "final" || g.home_score === null || g.away_score === null) continue;
        possible += 2;

        const pick = picks.find((pk) => pk.game_id === g.id && pk.player_id === p.id);
        if (!pick) continue;

        const actualWinner =
          g.home_score > g.away_score
            ? g.home_team
            : g.away_score > g.home_score
              ? g.away_team
              : null;
        if (actualWinner && pick.winner_pick === actualWinner) correct++;

        if (pick.ou_pick && g.total_line !== null) {
          const total = g.home_score + g.away_score;
          if (pick.ou_pick === "Over" && total > g.total_line) correct++;
          if (pick.ou_pick === "Under" && total < g.total_line) correct++;
        }
      }
      return { id: p.id, name: p.display_name, correct, possible };
    })
    .sort((a, b) => b.correct - a.correct);
}

export default function WeeklyRecapCard({
  week,
  games,
  picks,
  profiles,
}: {
  week: number;
  games: Game[];
  picks: Pick[];
  profiles: Profile[];
}) {
  const results = computeWeeklyResults(games, picks, profiles);
  const topScore = results[0]?.correct ?? 0;
  const leaderIds = new Set(
    topScore > 0 ? results.filter((r) => r.correct === topScore).map((r) => r.id) : []
  );

  const finalGames = games.filter(
    (g) => g.status === "final" && g.home_score !== null && g.away_score !== null
  );
  const overs = finalGames.filter(
    (g) => g.total_line !== null && g.home_score! + g.away_score! > g.total_line!
  ).length;
  const unders = finalGames.filter(
    (g) => g.total_line !== null && g.home_score! + g.away_score! < g.total_line!
  ).length;

  const closest = finalGames.reduce<{ game: Game; diff: number } | null>((min, g) => {
    const diff = Math.abs((g.home_score ?? 0) - (g.away_score ?? 0));
    return !min || diff < min.diff ? { game: g, diff } : min;
  }, null);

  return (
    <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/20 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-bold text-sm">📋 Week {week} Recap</h2>
        <span className="text-[11px] uppercase tracking-wide font-semibold text-emerald-400">
          Final
        </span>
      </div>

      <div className="space-y-1.5 mb-3">
        {results.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-sm">
            <span className="text-slate-200">
              {leaderIds.has(r.id) && "👑 "}
              {r.name}
            </span>
            <span className="text-slate-400">
              {r.correct}/{r.possible} correct
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-700/60 pt-2 text-xs text-slate-400 space-y-1">
        <div>
          Totals this week: {overs} Over · {unders} Under
        </div>
        {closest && (
          <div>
            Closest game: {closest.game.away_team} {closest.game.away_score}–
            {closest.game.home_score} {closest.game.home_team}
          </div>
        )}
      </div>
    </div>
  );
}
