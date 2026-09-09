"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TeamBadge from "./TeamBadge";
import type { Game, Pick, Profile } from "@/lib/types";

export default function GameCard({
  game,
  myUserId,
  myPick,
  profiles,
  visiblePicks,
  locked,
}: {
  game: Game;
  myUserId: string;
  myPick: Pick | null;
  profiles: Profile[];
  visiblePicks: Pick[]; // whatever RLS let through — already hides non-final picks from others
  locked: boolean; // computed server-side (request time) so it can't drift from the DB's own check
}) {
  const [winner, setWinner] = useState(myPick?.winner_pick ?? "");
  const [ou, setOu] = useState<"Over" | "Under" | "">(myPick?.ou_pick ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (nextWinner: string, nextOu: "Over" | "Under" | "") => {
    if (locked) return;
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase.from("picks").upsert(
      {
        game_id: game.id,
        player_id: myUserId,
        winner_pick: nextWinner || null,
        ou_pick: nextOu || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "game_id,player_id" }
    );
    setSaving(false);
    setSaved(true);
  };

  const kickoff = new Date(game.kickoff_time);
  const kickoffLabel = kickoff.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const otherProfiles = profiles.filter((p) => p.id !== myUserId);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400">{kickoffLabel}</span>
        {game.status === "final" ? (
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-300">
            Final
          </span>
        ) : game.status === "live" ? (
          <span className="text-[11px] uppercase tracking-wide font-semibold text-red-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" /> Live
          </span>
        ) : locked ? (
          <span className="text-[11px] uppercase tracking-wide font-semibold text-amber-400 flex items-center gap-1">
            🔒 Locked
          </span>
        ) : (
          <span className="text-[11px] uppercase tracking-wide font-semibold text-emerald-400">
            Open
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
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

      <div className="text-center text-xs text-slate-400 mb-4">
        Total: <span className="text-slate-200 font-semibold">{game.total_line ?? "TBD"}</span>
      </div>

      {/* My pick */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {[game.away_team, game.home_team].map((team) => (
          <button
            key={team}
            disabled={locked}
            onClick={() => {
              setWinner(team);
              save(team, ou);
            }}
            className={`rounded-lg py-2 text-xs font-semibold border transition ${
              winner === team
                ? "bg-emerald-600 border-emerald-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {team}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {(["Over", "Under"] as const).map((opt) => (
          <button
            key={opt}
            disabled={locked}
            onClick={() => {
              setOu(opt);
              save(winner, opt);
            }}
            className={`rounded-lg py-2 text-xs font-semibold border transition ${
              ou === opt
                ? "bg-sky-600 border-sky-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="text-[11px] text-slate-500 h-4 mb-2">
        {saving ? "Saving…" : saved ? "Pick saved ✓" : locked ? "Picks are locked for this game" : ""}
      </div>

      {/* Other players */}
      <div className="border-t border-slate-800 pt-2 mt-1 space-y-1">
        {otherProfiles.map((p) => {
          const theirPick = visiblePicks.find((pk) => pk.player_id === p.id);
          return (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{p.display_name}</span>
              {theirPick ? (
                <span className="text-slate-200">
                  {theirPick.winner_pick ?? "—"} · {theirPick.ou_pick ?? "—"}
                </span>
              ) : (
                <span className="text-slate-600 italic">🔒 hidden until final</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
