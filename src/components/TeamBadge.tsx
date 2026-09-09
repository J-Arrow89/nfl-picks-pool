"use client";

import { useState } from "react";
import { getTeam } from "@/lib/teams";

export default function TeamBadge({
  team,
  size = 44,
}: {
  team: string;
  size?: number;
}) {
  const info = getTeam(team);
  const [imgFailed, setImgFailed] = useState(false);

  if (!imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/team-logos/${info.slug}.png`}
        alt={team}
        width={size}
        height={size}
        onError={() => setImgFailed(true)}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-extrabold shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${info.primary}, ${info.secondary})`,
        color: "#fff",
        fontSize: size * 0.32,
        boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
      }}
      title={team}
    >
      {info.abbr}
    </div>
  );
}
