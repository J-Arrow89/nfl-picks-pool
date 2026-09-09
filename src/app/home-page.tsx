import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import GameCard from "@/components/GameCard";
import type { Game, Pick, Profile } from "@/lib/types";

export default async function HomePage() {
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

  // Show the most recent week that has games.
  const { data: latestWeekRow } = await supabase
    .from("games")
    .select("week")
    .order("week", { ascending: false })
    .limit(1)
    .maybeSingle();

  const week = latestWeekRow?.week ?? 1;

  const { data: games } = await supabase
    .from("games")
    .select("*")
    .eq("week", week)
    .order("kickoff_time", { ascending: true });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name");

  const gameIds = (games ?? []).map((g) => g.id);
  const { data: picks } = gameIds.length
    ? await supabase.from("picks").select("*").in("game_id", gameIds)
    : { data: [] as Pick[] };

  return (
    <main
      className="relative min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: "url('/main-bg.jpg')" }}
    >
      <div className="fixed inset-0 bg-black/55 pointer-events-none" />
      <div className="relative z-10">
      <NavBar name={profile?.display_name ?? user.email ?? ""} />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-white text-xl font-bold mb-1">Week {week} Picks</h1>
        <p className="text-slate-400 text-sm mb-6">
          Winner + Over/Under, per game. Locks the moment kickoff hits.
        </p>

        {!games || games.length === 0 ? (
          <p className="text-slate-400 text-sm">
            No games loaded for this week yet — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(games as Game[]).map((game) => (
              <GameCard
                key={game.id}
                game={game}
                myUserId={user.id}
                myPick={
                  (picks as Pick[]).find(
                    (p) => p.game_id === game.id && p.player_id === user.id
                  ) ?? null
                }
                profiles={(profiles as Profile[]) ?? []}
                visiblePicks={(picks as Pick[]).filter((p) => p.game_id === game.id)}
                // eslint-disable-next-line react-hooks/purity -- server component, evaluated per-request; this is the correct place for a "has kickoff passed yet" check
                locked={new Date(game.kickoff_time).getTime() <= Date.now()}
              />
            ))}
          </div>
        )}
      </div>
      </div>
    </main>
  );
}
