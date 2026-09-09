import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";

export default async function StandingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const { data: standings } = await supabase
    .from("standings")
    .select("*")
    .order("total_points", { ascending: false });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950">
      <NavBar name={profile?.display_name ?? user.email ?? ""} />
      <div className="max-w-md mx-auto px-4 py-6">
        <h1 className="text-white text-xl font-bold mb-6">Season Standings</h1>
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 overflow-hidden">
          {(standings ?? []).map((row, i) => (
            <div
              key={row.player_id}
              className={`flex items-center justify-between px-4 py-3 ${
                i !== (standings?.length ?? 0) - 1 ? "border-b border-slate-800" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-slate-500 text-sm w-4">{i + 1}</span>
                <span className="text-white font-medium">{row.display_name}</span>
              </div>
              <span className="text-emerald-400 font-bold">{row.total_points ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
