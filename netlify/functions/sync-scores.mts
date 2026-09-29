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
  team?: { id?: string; displayName?: string };
};

type EspnOdds = {
  overUnder?: number;
};

type EspnCompetition = {
  competitors?: EspnCompetitor[];
  odds?: EspnOdds[];
};

type EspnEvent = {
  id?: string; // ESPN's event id — needed to fetch the full boxscore below
  date?: string; // ISO kickoff time
  status?: { type?: { name?: string } };
  competitions?: EspnCompetition[];
};

// ---- Full boxscore (summary endpoint) — only fetched once, the run a
// game transitions to final, since that's the only time its box score
// changes and it costs one extra ESPN call per finished game. ----

type GameLeader = { name: string; team: string; value: number; line: string };
type GameLeaders = {
  passing: GameLeader[];
  rushing: GameLeader[];
  receiving: GameLeader[];
};

type EspnBoxAthleteEntry = {
  athlete?: { displayName?: string };
  stats?: string[];
};

type EspnBoxStatCategory = {
  name?: string; // "passing" | "rushing" | "receiving" | ...
  labels?: string[];
  athletes?: EspnBoxAthleteEntry[];
};

type EspnBoxTeam = {
  team?: { displayName?: string };
  statistics?: EspnBoxStatCategory[];
};

type EspnSummary = {
  boxscore?: { players?: EspnBoxTeam[] };
};

async function fetchEspnSummary(eventId: string): Promise<EspnSummary | null> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`sync-scores: ESPN summary fetch failed for event ${eventId}: ${res.status}`);
    return null;
  }
  return (await res.json()) as EspnSummary;
}

// Pulls a numbered stat out of a box-score row by its column label
// (rather than a hardcoded index — ESPN's column order isn't guaranteed
// stable), e.g. statByLabel(labels, stats, "YDS").
function statByLabel(labels: string[], stats: string[], label: string): string | null {
  const idx = labels.indexOf(label);
  return idx === -1 ? null : (stats[idx] ?? null);
}

function toNumber(s: string | null): number | null {
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Builds every category's full-box-score leader list for one game, both
// teams combined. `passing` keeps every QB who threw a pass (not just
// one) because ranking by QBR/RTG requires comparing every candidate —
// the best-QBR passer in a game isn't always its top-yardage passer, so
// nobody can be left out here without risking a wrong week-wide winner.
// `rushing`/`receiving` only need each team's single leader, since yards
// is a fine metric and the week's max is always someone's game-high.
function extractBoxscoreLeaders(summary: EspnSummary | null): GameLeaders | null {
  const teams = summary?.boxscore?.players;
  if (!teams || teams.length === 0) return null;

  const passing: GameLeader[] = [];
  const rushing: GameLeader[] = [];
  const receiving: GameLeader[] = [];

  for (const team of teams) {
    const teamName = team.team?.displayName ?? "";

    const passingCat = team.statistics?.find((s) => s.name === "passing");
    for (const a of passingCat?.athletes ?? []) {
      const name = a.athlete?.displayName;
      const labels = passingCat?.labels ?? [];
      const stats = a.stats ?? [];
      if (!name || stats.length === 0) continue;

      const compAtt = statByLabel(labels, stats, "C/ATT");
      const yds = statByLabel(labels, stats, "YDS");
      const td = statByLabel(labels, stats, "TD");
      const int = statByLabel(labels, stats, "INT");
      const qbr = toNumber(statByLabel(labels, stats, "QBR"));
      const rtg = toNumber(statByLabel(labels, stats, "RTG"));
      // QBR is the better quality signal (accounts for game situation,
      // not just volume); RTG is the fallback for the rare game where
      // ESPN hasn't calculated QBR (e.g. very few attempts).
      const value = qbr ?? rtg;
      if (value === null) continue;

      const parts = [
        compAtt,
        yds !== null ? `${yds} YDS` : null,
        td !== null ? `${td} TD` : null,
        int !== null ? `${int} INT` : null,
        qbr !== null ? `QBR ${qbr}` : null,
        rtg !== null ? `RTG ${rtg}` : null,
      ].filter((p): p is string => p !== null);

      passing.push({ name, team: teamName, value, line: parts.join(", ") });
    }

    const rushingCat = team.statistics?.find((s) => s.name === "rushing");
    const rushLabels = rushingCat?.labels ?? [];
    let topRusher: GameLeader | null = null;
    for (const a of rushingCat?.athletes ?? []) {
      const name = a.athlete?.displayName;
      const stats = a.stats ?? [];
      const yds = toNumber(statByLabel(rushLabels, stats, "YDS"));
      if (!name || yds === null) continue;
      if (!topRusher || yds > topRusher.value) {
        const car = statByLabel(rushLabels, stats, "CAR");
        const avg = statByLabel(rushLabels, stats, "AVG");
        const td = statByLabel(rushLabels, stats, "TD");
        const long = statByLabel(rushLabels, stats, "LONG");
        const parts = [
          car !== null ? `${car} CAR` : null,
          `${yds} YDS`,
          avg !== null ? `${avg} AVG` : null,
          td !== null ? `${td} TD` : null,
          long !== null ? `LONG ${long}` : null,
        ].filter((p): p is string => p !== null);
        topRusher = { name, team: teamName, value: yds, line: parts.join(", ") };
      }
    }
    if (topRusher) rushing.push(topRusher);

    const receivingCat = team.statistics?.find((s) => s.name === "receiving");
    const recLabels = receivingCat?.labels ?? [];
    let topReceiver: GameLeader | null = null;
    for (const a of receivingCat?.athletes ?? []) {
      const name = a.athlete?.displayName;
      const stats = a.stats ?? [];
      const yds = toNumber(statByLabel(recLabels, stats, "YDS"));
      if (!name || yds === null) continue;
      if (!topReceiver || yds > topReceiver.value) {
        const rec = statByLabel(recLabels, stats, "REC");
        const avg = statByLabel(recLabels, stats, "AVG");
        const td = statByLabel(recLabels, stats, "TD");
        const long = statByLabel(recLabels, stats, "LONG");
        const tgts = statByLabel(recLabels, stats, "TGTS");
        const parts = [
          rec !== null ? `${rec} REC` : null,
          `${yds} YDS`,
          avg !== null ? `${avg} AVG` : null,
          td !== null ? `${td} TD` : null,
          long !== null ? `LONG ${long}` : null,
          tgts !== null ? `${tgts} TGT` : null,
        ].filter((p): p is string => p !== null);
        topReceiver = { name, team: teamName, value: yds, line: parts.join(", ") };
      }
    }
    if (topReceiver) receiving.push(topReceiver);
  }

  if (passing.length === 0 && rushing.length === 0 && receiving.length === 0) return null;
  return { passing, rushing, receiving };
}

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

        const comp = match.competitions?.[0];
        const comps = comp?.competitors ?? [];
        const homeC = comps.find((c) => c.homeAway === "home");
        const awayC = comps.find((c) => c.homeAway === "away");
        const status = mapStatus(match.status?.type?.name);

        // Box score (with QBR/RTG and full stat lines) is only worth
        // fetching the run a game actually finishes — g.status here is
        // its status BEFORE this update, so this only fires once per game.
        let leaders: GameLeaders | null = null;
        if (status === "final" && g.status !== "final" && match.id) {
          try {
            const summary = await fetchEspnSummary(match.id);
            leaders = extractBoxscoreLeaders(summary);
          } catch (err) {
            console.error(`sync-scores: boxscore fetch failed for game ${g.id}`, err);
          }
        }

        const { error: updateError } = await supabase
          .from("games")
          .update({
            home_score: homeC?.score !== undefined ? Number(homeC.score) : null,
            away_score: awayC?.score !== undefined ? Number(awayC.score) : null,
            status,
            ...(leaders ? { leaders } : {}),
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
