"use client";

import { useState } from "react";
import type { Game, GameLeader } from "@/lib/types";

type Category = "passing" | "rushing" | "receiving";

const CATEGORY_META: Record<Category, { icon: string; label: string }> = {
  passing: { icon: "🎯", label: "Top QB" },
  rushing: { icon: "🏃", label: "Top RB" },
  receiving: { icon: "🙌", label: "Top WR/TE" },
};

// Flattens every game's stored leader arrays together and keeps the
// single highest `value` in each category across the whole week. For
// passing that's Adjusted QBR (Passer Rating as a fallback) — the real
// quality signal, not raw yardage — comparing every QB who threw a pass
// that week, since the best-QBR passer in a game isn't always its
// top-yardage passer. For rushing/receiving, yards is exact as-is: the
// week's leader is always someone's own game-high, so scanning each
// game's single stored leader per team is sufficient.
function bestOfWeek(games: Game[], category: Category): GameLeader | null {
  let best: GameLeader | null = null;
  for (const g of games) {
    for (const entry of g.leaders?.[category] ?? []) {
      if (!best || entry.value > best.value) best = entry;
    }
  }
  return best;
}

export default function WeeklyTopPerformers({ week, games }: { week: number; games: Game[] }) {
  const [expanded, setExpanded] = useState<Category | null>(null);

  const categories: Category[] = ["passing", "rushing", "receiving"];
  const results = categories
    .map((cat) => ({ cat, leader: bestOfWeek(games, cat) }))
    .filter((r): r is { cat: Category; leader: GameLeader } => r.leader !== null);

  if (results.length === 0) return null;

  return (
    <div className="rounded-2xl border border-sky-700/40 bg-sky-950/20 p-4 mb-6">
      <h2 className="text-white font-bold text-sm mb-3">🏆 Week {week} Top Performers</h2>
      <div className="space-y-1">
        {results.map(({ cat, leader }) => {
          const meta = CATEGORY_META[cat];
          const isOpen = expanded === cat;
          return (
            <div key={cat}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : cat)}
                className="w-full flex items-center justify-between gap-3 text-sm py-1.5 text-left hover:bg-white/5 rounded-lg px-1.5 -mx-1.5 transition"
              >
                <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                  <span>{meta.icon}</span>
                  {meta.label}
                </span>
                <span className="text-right text-slate-100 flex items-center gap-1.5">
                  <span className="font-semibold">{leader.name}</span>
                  {leader.team && (
                    <span className="text-slate-500 text-xs">· {leader.team}</span>
                  )}
                  <span className="text-slate-500 text-xs">{isOpen ? "▲" : "▼"}</span>
                </span>
              </button>
              {isOpen && (
                <div className="text-xs text-slate-300 bg-slate-950/50 rounded-lg px-3 py-2 mb-1">
                  {leader.line}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-600 mt-3">
        Ranked by ESPN&apos;s real box-score stats — QBR for passing, yards for rushing and
        receiving. Tap a name for their full stat line. Not an official award, just the actual
        best statistical week at each spot.
      </p>
    </div>
  );
}
