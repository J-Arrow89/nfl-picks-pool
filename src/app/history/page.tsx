import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import RotatingBackground from "@/components/RotatingBackground";
import HistoryGameCard from "@/components/HistoryGameCard";
import WeeklyTopPerformers from "@/components/WeeklyTopPerformers";
import type { Game, Pick, Profile } from "@/lib/types";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware already redirects to /login

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const { data: profiles } = await supabase.from("profiles").select("id, display_name");

  // Every distinct week that has at least one game, newest first.
  const { data: weekRows } = await supabase
    .from("games")
    .select("week")
    .order("week", { ascending: false });

  const weeks = [...new Set((weekRows ?? []).map((r) => r.week))];

  const params = await searchParams;
  const requestedWeek = params.week ? Number(params.week) : null;
  const selectedWeek =
    requestedWeek && weeks.includes(requestedWeek) ? requestedWeek : (weeks[0] ?? null);

  let games: Game[] = [];
  let picks: Pick[] = [];
  if (selectedWeek !== null) {
    const { data: weekGames } = await supabase
      .from("games")
      .select("*")
      .eq("week", selectedWeek)
      .order("kickoff_time", { ascending: true });
    games = (weekGames as Game[]) ?? [];

    const gameIds = games.map((g) => g.id);
    if (gameIds.length > 0) {
      const { data: weekPicks } = await supabase.from("picks").select("*").in("game_id", gameIds);
      picks = (weekPicks as Pick[]) ?? [];
    }
  }

  return (
    <main className="relative min-h-screen">
      <RotatingBackground />
      <div className="fixed inset-0 bg-black/55 pointer-events-none" />
      <div className="relative z-10">
        <NavBar name={profile?.display_name ?? user.email ?? ""} />
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-white text-xl font-bold mb-1">Past Weeks</h1>
          <p className="text-slate-400 text-sm mb-4">
            Every past matchup, final score, and how everyone picked.
          </p>

          {weeks.length === 0 ? (
            <p className="text-slate-400 text-sm">No games recorded yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-6">
                {weeks.map((w) => (
                  <Link
                    key={w}
                    href={`/history?week=${w}`}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                      w === selectedWeek
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Week {w}
                  </Link>
                ))}
              </div>

              {games.length === 0 ? (
                <p className="text-slate-400 text-sm">No games found for that week.</p>
              ) : (
                <>
                  {selectedWeek !== null && (
                    <WeeklyTopPerformers week={selectedWeek} games={games} />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {games.map((game) => (
                      <HistoryGameCard
                        key={game.id}
                        game={game}
                        picks={picks.filter((p) => p.game_id === game.id)}
                        profiles={(profiles as Profile[]) ?? []}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
