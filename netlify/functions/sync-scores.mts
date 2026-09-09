import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// Runs every 5 minutes (see `config.schedule` below) and does two things,
// both against ESPN's free public scoreboard feed (no API key needed):
//
// 1. Score sync: for every one of our games that isn't marked "final" yet,
//    look up that NFL week's scoreboard and write back home/away score +
//    status (upcoming/live/final).
// 2. Schedule rollover: once the current week's games are all final (or a
//    couple days have passed as a safety net in case one never got marked
//    final), automatically fetch and insert next week's matchups, kickoff
//    times, and Over/Under totals — so Paul doesn't have to run a manual
//    SQL seed every week. This step is naturally idempotent: it only ever
//    inserts a week's games once (it checks first), so re-running it every
//    5 minutes costs nothing extra once that week is in the table.
//
// Both use the Supabase *service role* key (server-side only, never exposed
// to the browser) so writes go through regardless of row-level security —
// regular players still can't touch this table directly.
//
// Team matching: our `games.home_team` / `away_team` are stored as ESPN's
// own `displayName` strings, e.g. "Kansas City Chiefs" (see src/lib/teams.ts)
// — that's what lets both steps below match rows reliably by team name.

type EspnCompetitor = {
  homeAway: "home" | "away";
  score?: string;
  team?: { displayName?: string };
};

type EspnOdds = {
  overUnder?: number;
};

type EspnCompetition = {
  competitors?: EspnCompetitor[];
  odds?: EspnOdds[];
};

type EspnEvent = {
  date?: string; // ISO kickoff time
  status?: { type?: { name?: string } };
  competitions?: EspnCompetition[];
};

function mapStatus(espnStatusName: string | undefined): "upcoming" | "live" | "final" {
  if (espnStatusName === "STATUS_FINAL") return "final";
  if (espnStatusName === "STATUS_SCHEDULED" || espnStatusName === "STATUS_POSTPONED") {
    return "upcoming";
  }
  // STATUS_IN_PROGRESS, STATUS_HALFTIME, STATUS_END_PERIOD, etc.
  return "live";
}

// ESPN's `year` query param means "season start year", not calendar year —
// games in Jan/Feb belong to the season that started the previous fall.
function seasonYearFor(date: Date): number {
  const month = date.getUTCMonth(); // 0 = Jan
  return month <= 1 ? date.getUTCFullYear() - 1 : date.getUTCFullYear();
}

async function fetchEspnWeek(week: number, seasonYear: number): Promise<EspnEvent[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&year=${seasonYear}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`sync-scores: ESPN fetch failed for week ${week}: ${res.status}`);
    return [];
  }
  const json = (await res.json()) as { events?: EspnEvent[] };
  return json.events ?? [];
}

const syncScores = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("sync-scores: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response("missing env vars", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ---------- 1. Score sync for any non-final games ----------
  let scoresUpdated = 0;

  const { data: pendingGames, error: pendingError } = await supabase
    .from("games")
    .select("id, week, home_team, away_team, kickoff_time, status")
    .neq("status", "final");

  if (pendingError) {
    console.error("sync-scores: failed to read pending games", pendingError);
  } else if (pendingGames && pendingGames.length > 0) {
    const weeks = [...new Set(pendingGames.map((g) => g.week))];

    for (const week of weeks) {
      const gamesInWeek = pendingGames.filter((g) => g.week === week);
      const seasonYear = seasonYearFor(new Date(gamesInWeek[0].kickoff_time));

      let events: EspnEvent[] = [];
      try {
        events = await fetchEspnWeek(week, seasonYear);
      } catch (err) {
        console.error(`sync-scores: ESPN fetch threw for week ${week}`, err);
        continue;
      }

      for (const g of gamesInWeek) {
        const match = events.find((e) => {
          const comps = e.competitions?.[0]?.competitors ?? [];
          const home = comps.find((c) => c.homeAway === "home")?.team?.displayName;
          const away = comps.find((c) => c.homeAway === "away")?.team?.displayName;
          return home === g.home_team && away === g.away_team;
        });
        if (!match) continue;

        const comps = match.competitions?.[0]?.competitors ?? [];
        const homeC = comps.find((c) => c.homeAway === "home");
        const awayC = comps.find((c) => c.homeAway === "away");
        const status = mapStatus(match.status?.type?.name);

        const { error: updateError } = await supabase
          .from("games")
          .update({
            home_score: homeC?.score !== undefined ? Number(homeC.score) : null,
            away_score: awayC?.score !== undefined ? Number(awayC.score) : null,
            status,
          })
          .eq("id", g.id);

        if (updateError) {
          console.error(`sync-scores: failed to update game ${g.id}`, updateError);
        } else {
          scoresUpdated++;
        }
      }
    }
  }

  // ---------- 2. Auto-add next week's schedule once this week is done ----------
  let scheduleInserted = 0;

  const { data: maxWeekRow, error: maxWeekError } = await supabase
    .from("games")
    .select("week")
    .order("week", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxWeekError) {
    console.error("sync-scores: failed to read max week", maxWeekError);
  } else if (maxWeekRow && maxWeekRow.week < 18) {
    const maxWeek = maxWeekRow.week;

    const { data: currentWeekGames, error: currentWeekError } = await supabase
      .from("games")
      .select("kickoff_time, status")
      .eq("week", maxWeek);

    if (currentWeekError) {
      console.error("sync-scores: failed to read current week games", currentWeekError);
    } else if (currentWeekGames && currentWeekGames.length > 0) {
      const allFinal = currentWeekGames.every((g) => g.status === "final");
      const latestKickoff = currentWeekGames.reduce(
        (max, g) => Math.max(max, new Date(g.kickoff_time).getTime()),
        0
      );
      const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
      const pastSafetyWindow = Date.now() > latestKickoff + twoDaysMs;

      if (allFinal || pastSafetyWindow) {
        const nextWeek = maxWeek + 1;

        const { count: existingNextWeekCount, error: countError } = await supabase
          .from("games")
          .select("id", { count: "exact", head: true })
          .eq("week", nextWeek);

        if (countError) {
          console.error("sync-scores: failed to check for existing next-week games", countError);
        } else if (!existingNextWeekCount) {
          const seasonYear = seasonYearFor(new Date(currentWeekGames[0].kickoff_time));

          try {
            const events = await fetchEspnWeek(nextWeek, seasonYear);

            const newGames = events
              .map((e) => {
                const comp = e.competitions?.[0];
                const comps = comp?.competitors ?? [];
                const home = comps.find((c) => c.homeAway === "home");
                const away = comps.find((c) => c.homeAway === "away");
                const overUnder = comp?.odds?.[0]?.overUnder;

                if (!home?.team?.displayName || !away?.team?.displayName || !e.date) {
                  return null;
                }

                return {
                  week: nextWeek,
                  kickoff_time: e.date,
                  home_team: home.team.displayName,
                  away_team: away.team.displayName,
                  // ESPN's odds field is undocumented/best-effort — some
                  // games (especially early in the week) may not have a
                  // total posted yet. Falls back to "TBD" in the UI.
                  total_line: typeof overUnder === "number" ? overUnder : null,
                };
              })
              .filter((g): g is NonNullable<typeof g> => g !== null);

            if (newGames.length > 0) {
              const { error: insertError } = await supabase.from("games").insert(newGames);
              if (insertError) {
                console.error(`sync-scores: failed to insert week ${nextWeek} schedule`, insertError);
              } else {
                scheduleInserted = newGames.length;
              }
            }
          } catch (err) {
            console.error(`sync-scores: failed to fetch/insert week ${nextWeek} schedule`, err);
          }
        }
      }
    }
  }

  return new Response(
    `ok — updated ${scoresUpdated} score(s), inserted ${scheduleInserted} new game(s)`,
    { status: 200 }
  );
};

export default syncScores;

export const config: Config = {
  schedule: "*/5 * * * *",
};
