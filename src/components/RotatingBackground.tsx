"use client";

import { useEffect, useState } from "react";

// Looks for /public/main-bg-1.jpg, main-bg-2.jpg, ... up to main-bg-8.jpg.
// Add or remove numbered files in GitHub (keeping them sequential starting
// at 1, no gaps) and this picks up the change automatically — no code
// change needed. Falls back to the original single /main-bg.jpg if none of
// the numbered files exist, so it stays backward-compatible.
const MAX_CANDIDATES = 8;
const CANDIDATE_PATHS = Array.from(
  { length: MAX_CANDIDATES },
  (_, i) => `/main-bg-${i + 1}.jpg`
);
const FALLBACK = ["/main-bg.jpg"];
const ROTATE_MS = 5000;

export default function RotatingBackground() {
  const [images, setImages] = useState<string[]>(FALLBACK);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      CANDIDATE_PATHS.map(
        (src) =>
          new Promise<string | null>((resolve) => {
            const img = new window.Image();
            img.onload = () => resolve(src);
            img.onerror = () => resolve(null);
            img.src = src;
          })
      )
    ).then((results) => {
      if (cancelled) return;
      const found = results.filter((r): r is string => r !== null);
      setImages(found.length > 0 ? found : FALLBACK);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [images]);

  return (
    <>
      {images.map((src, i) => (
        <div
          key={src}
          aria-hidden
          className="fixed inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
          style={{ backgroundImage: `url('${src}')`, opacity: i === index ? 1 : 0 }}
        />
      ))}
    </>
  );
}
