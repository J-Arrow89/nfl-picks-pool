"use client";

import { useEffect, useState } from "react";
import type { Game, Pick } from "@/lib/types";

/**
 * Shows a countdown banner when the signed-in player still has an
 * incomplete pick (missing winner and/or Over/Under) on a game that
 * hasn't kicked off yet. Ticks every 30s so the countdown stays fresh
 * without hammering the client. Renders nothing once every remaining
 * game is either picked or already locked.
 *
 * `now` starts as null and is only set client-side in an effect so the
 * server-rendered markup and the first client render match (avoids a
 * hydration mismatch from using Date.now() directly during render).
 */
export default function PicksDueBanner({
  games,
  myPicks,
}: {
  games: Game[];
  myPicks: Pick[];
}) {
  // Lazy initializer (not an effect) so the client's first render already
  // has a real timestamp — avoids a synchronous setState-in-effect lint
  // error while still keeping the server-rendered pass at `null`.
  const [now, setNow] = useState<number | null>(() =>
    typeof window === "undefined" ? null : Date.now()
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return null;

  const incomplete = games
    .filter((g) => new Date(g.kickoff_time).getTime() > now)
    .filter((g) => {
      const pick = myPicks.find((p) => p.game_id === g.id);
      return !pick || !pick.winner_pick || !pick.ou_pick;
    })
    .sort(
      (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
    );

  if (incomplete.length === 0) return null;

  const next = incomplete[0];
  const msLeft = new Date(next.kickoff_time).getTime() - now;
  const totalMinutes = Math.max(0, Math.floor(msLeft / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const timeLabel =
    days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const urgent = msLeft < 60 * 60 * 1000; // under 1 hour
  const soon = msLeft < 6 * 60 * 60 * 1000; // under 6 hours

  const colorClasses = urgent
    ? "bg-red-950/60 border-red-700 text-red-200"
    : soon
      ? "bg-amber-950/60 border-amber-700 text-amber-200"
      : "bg-slate-900/70 border-slate-700 text-slate-200";

  return (
    <div
      className={`rounded-xl border px-4 py-3 mb-5 text-sm flex items-center gap-2 ${colorClasses}`}
    >
      <span>⏰</span>
      {incomplete.length === 1 ? (
        <span>
          Pick <strong>{next.away_team} @ {next.home_team}</strong> before it locks —{" "}
          <strong>{timeLabel}</strong> left
        </span>
      ) : (
        <span>
          You still have <strong>{incomplete.length} games</strong> to pick — next one locks
          in <strong>{timeLabel}</strong>
        </span>
      )}
    </div>
  );
}
