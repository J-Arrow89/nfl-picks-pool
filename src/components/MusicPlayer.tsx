"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "who-ya-got-music-muted";

/**
 * Lives in the root layout so it mounts once and keeps playing across
 * client-side navigation between /login, /, and /standings. Browsers block
 * autoplay with sound, so it starts muted and the button doubles as both
 * the "turn music on" control and a mute toggle after that.
 */
function readStoredMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    // localStorage unavailable (private browsing, etc.) — default to muted.
    return true;
  }
}

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Lazy initializer only — reads localStorage once on mount, not inside an
  // effect, so there's no synchronous setState-in-effect cascade.
  const [muted, setMuted] = useState(readStoredMuted);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = muted;
    // Attempt to play regardless of mute state; if unmuted playback is
    // blocked before a user gesture, the browser will simply keep it
    // paused until the toggle button is clicked.
    audioRef.current.play().catch(() => {});
  }, [muted]);

  const toggle = () => {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <>
      <audio ref={audioRef} src="/audio/football.mp3" loop autoPlay playsInline />
      <button
        type="button"
        onClick={toggle}
        aria-label={muted ? "Turn music on" : "Mute music"}
        title={muted ? "Turn music on" : "Mute music"}
        className="fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/90 border border-slate-700 text-lg shadow-lg backdrop-blur hover:bg-slate-800 transition"
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </>
  );
}
