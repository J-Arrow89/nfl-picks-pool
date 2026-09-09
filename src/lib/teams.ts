export type TeamInfo = {
  slug: string;
  abbr: string;
  primary: string;
  secondary: string;
};

// Colors are public team-color info (not logo artwork) — safe to hardcode.
// Drop an actual logo file at /public/team-logos/<slug>.png and TeamBadge
// will automatically use it instead of the colored-initials fallback.
export const TEAMS: Record<string, TeamInfo> = {
  "Arizona Cardinals": { slug: "cardinals", abbr: "ARI", primary: "#97233F", secondary: "#000000" },
  "Atlanta Falcons": { slug: "falcons", abbr: "ATL", primary: "#A71930", secondary: "#000000" },
  "Baltimore Ravens": { slug: "ravens", abbr: "BAL", primary: "#241773", secondary: "#000000" },
  "Buffalo Bills": { slug: "bills", abbr: "BUF", primary: "#00338D", secondary: "#C60C30" },
  "Carolina Panthers": { slug: "panthers", abbr: "CAR", primary: "#0085CA", secondary: "#101820" },
  "Chicago Bears": { slug: "bears", abbr: "CHI", primary: "#0B162A", secondary: "#C83803" },
  "Cincinnati Bengals": { slug: "bengals", abbr: "CIN", primary: "#FB4F14", secondary: "#000000" },
  "Cleveland Browns": { slug: "browns", abbr: "CLE", primary: "#311D00", secondary: "#FF3C00" },
  "Dallas Cowboys": { slug: "cowboys", abbr: "DAL", primary: "#041E42", secondary: "#869397" },
  "Denver Broncos": { slug: "broncos", abbr: "DEN", primary: "#FB4F14", secondary: "#002244" },
  "Detroit Lions": { slug: "lions", abbr: "DET", primary: "#0076B6", secondary: "#B0B7BC" },
  "Green Bay Packers": { slug: "packers", abbr: "GB", primary: "#203731", secondary: "#FFB612" },
  "Houston Texans": { slug: "texans", abbr: "HOU", primary: "#03202F", secondary: "#A71930" },
  "Indianapolis Colts": { slug: "colts", abbr: "IND", primary: "#002C5F", secondary: "#A2AAAD" },
  "Jacksonville Jaguars": { slug: "jaguars", abbr: "JAX", primary: "#101820", secondary: "#D7A22A" },
  "Kansas City Chiefs": { slug: "chiefs", abbr: "KC", primary: "#E31837", secondary: "#FFB81C" },
  "Las Vegas Raiders": { slug: "raiders", abbr: "LV", primary: "#000000", secondary: "#A5ACAF" },
  "Los Angeles Chargers": { slug: "chargers", abbr: "LAC", primary: "#0080C6", secondary: "#FFC20E" },
  "Los Angeles Rams": { slug: "rams", abbr: "LAR", primary: "#003594", secondary: "#FFA300" },
  "Miami Dolphins": { slug: "dolphins", abbr: "MIA", primary: "#008E97", secondary: "#FC4C02" },
  "Minnesota Vikings": { slug: "vikings", abbr: "MIN", primary: "#4F2683", secondary: "#FFC62F" },
  "New England Patriots": { slug: "patriots", abbr: "NE", primary: "#002244", secondary: "#C60C30" },
  "New Orleans Saints": { slug: "saints", abbr: "NO", primary: "#D3BC8D", secondary: "#101820" },
  "New York Giants": { slug: "giants", abbr: "NYG", primary: "#0B2265", secondary: "#A71930" },
  "New York Jets": { slug: "jets", abbr: "NYJ", primary: "#125740", secondary: "#000000" },
  "Philadelphia Eagles": { slug: "eagles", abbr: "PHI", primary: "#004C54", secondary: "#A5ACAF" },
  "Pittsburgh Steelers": { slug: "steelers", abbr: "PIT", primary: "#FFB612", secondary: "#101820" },
  "San Francisco 49ers": { slug: "49ers", abbr: "SF", primary: "#AA0000", secondary: "#B3995D" },
  "Seattle Seahawks": { slug: "seahawks", abbr: "SEA", primary: "#002244", secondary: "#69BE28" },
  "Tampa Bay Buccaneers": { slug: "buccaneers", abbr: "TB", primary: "#D50A0A", secondary: "#34302B" },
  "Tennessee Titans": { slug: "titans", abbr: "TEN", primary: "#0C2340", secondary: "#4B92DB" },
  "Washington Commanders": { slug: "commanders", abbr: "WAS", primary: "#5A1414", secondary: "#FFB612" },
};

export function getTeam(name: string): TeamInfo {
  return (
    TEAMS[name] ?? { slug: "nfl", abbr: name.slice(0, 3).toUpperCase(), primary: "#334155", secondary: "#94a3b8" }
  );
}
