"use client";

import { useRef, useState } from "react";
import type { SyntheticEvent } from "react";

const STORAGE_KEY = "who-ya-got-music-muted";

/**
 * Lives in the root layout so it mounts once and keeps playing across
 * client-side navigation between /login, /, and /standings. Browsers block
 * autoplay with sound, so it starts muted and the button doubles as both
 * the "turn music on" control and a mute toggle after that.
 *
 * No autoplay attribute and no eager preload here on purpose: on mobile
 * (especially with low-data mode on cellular), browsers will abort an
 * eagerly-preloading/autoplaying <audio> element and fire a real `error`
 * event even though the file is perfectly fine — that's what was causing
 * the permanent caution icon on phones while it worked fine on desktop.
 * Instead, loading only starts once the button is actually pressed.
 */
function readStoredMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(readStoredMuted);
  const [loadError, setLoadError] = useState(false);

  const handleError = (e: SyntheticEvent<HTMLAudioElement>) => {
    const code = e.currentTarget.error?.code;
    // Code 1 = MEDIA_ERR_ABORTED — the browser cancelled the load itself
    // (data saver, backgrounding, etc.), not a real failure. Only treat
    // network/decode/unsupported errors (2, 3, 4) as a genuine problem.
    if (code && code !== MediaError.MEDIA_ERR_ABORTED) {
      setLoadError(true);
    }
  };

  // play() is called directly inside the click handler (not an effect) so
  // it's still tied to the user gesture — required for unmuted playback on
  // Safari/iOS in particular.
  const toggle = () => {
    const audio = audioRef.current;
    const next = !muted;

    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore
    }

    if (audio) {
      if (loadError) {
        // Give it a fresh shot rather than staying stuck on a stale error.
        setLoadError(false);
        audio.load();
      }
      audio.muted = next;
      audio.play().catch(() => {
        // Actual playback failure (not caught by the error event) — surface it.
        setLoadError(true);
      });
    }

    setMuted(next);
  };

  return (
    <>
      <audio
        ref={audioRef}
        src="/audio/football.mp3"
        loop
        playsInline
        preload="none"
        onError={handleError}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={muted ? "Turn music on" : "Mute music"}
        title={
          loadError
            ? "Couldn't load music — tap to retry"
            : muted
              ? "Turn music on"
              : "Mute music"
        }
        className="fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/90 border border-slate-700 text-lg shadow-lg backdrop-blur hover:bg-slate-800 transition"
      >
        {loadError ? "⚠️" : muted ? "🔇" : "🔊"}
      </button>
    </>
  );
}
