import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { isNativeApp } from "../lib/google";

// Plays once per app launch (the phone app only): a point of light becomes a line, the GABLA wordmark is unveiled
// from the centre with a golden sheen, the tagline rises, then the splash lifts away. Tap to skip.
let alreadyPlayed = false;

const SPARKS = Array.from({ length: 14 }, (_, i) => ({
  left: 12 + ((i * 53) % 76),
  delay: 1.0 + ((i * 29) % 12) / 10,
  dur: 1.8 + ((i * 17) % 14) / 10,
  size: 2 + (i % 3)
}));

export default function AppSplash() {
  const { t } = useTranslation();
  // `?splash` plays it in a normal browser too (handy for previewing).
  const wanted = () => isNativeApp() || (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("splash"));
  const [phase, setPhase] = useState(() => (alreadyPlayed || !wanted() ? "gone" : "in"));

  useEffect(() => {
    if (phase === "gone") return undefined;
    alreadyPlayed = true;
    // The native splash is a plain blue screen with the first point of light: hand over to this one.
    try {
      window.Capacitor?.Plugins?.SplashScreen?.hide?.({ fadeOutDuration: 150 });
    } catch {
      // Not running inside the app shell.
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const out = window.setTimeout(() => setPhase("out"), reduce ? 900 : 3300);
    const gone = window.setTimeout(() => setPhase("gone"), reduce ? 1300 : 3900);
    return () => {
      window.clearTimeout(out);
      window.clearTimeout(gone);
    };
  }, [phase === "gone"]);

  if (phase === "gone") return null;
  return (
    <div className={`splash ${phase === "out" ? "is-out" : ""}`} onPointerDown={() => setPhase("out")} role="presentation">
      <div className="splash-glow" aria-hidden="true" />
      <div className="splash-stage">
        <i className="splash-dot" aria-hidden="true" />
        <i className="splash-line" aria-hidden="true" />
        <div className="splash-mark-wrap">
          <span className="splash-mark" role="img" aria-label="Gabla" />
          <span className="splash-sheen" aria-hidden="true" />
        </div>
        <div className="splash-sparks" aria-hidden="true">
          {SPARKS.map((s, i) => (
            <i key={i} style={{ left: `${s.left}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`, width: s.size, height: s.size }} />
          ))}
        </div>
        <p className="splash-tag">{t("home.eyebrow")}</p>
      </div>
    </div>
  );
}
