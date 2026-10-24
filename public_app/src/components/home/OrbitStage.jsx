import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { IconArrowRight, IconBus, IconCar, IconCart, IconCheck, IconGrid, IconLock, IconPin, IconSearch, IconSparkles } from "../icons";

const MAX_TILES = 16;
const ORBIT_SECONDS = 70;
const TAU = Math.PI * 2;

// The Gabla bowl artwork (same as the admin sign-in screen) is drawn on a 1200x520 canvas.
const BOWL_W = 1200;
const BOWL_H = 520;
const MOUTH_Y = 182; // centre of the bowl's opening, in artwork units

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (v, a, b) => {
  const x = clamp((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const lerp = (a, b, t) => a + (b - a) * t;

// The points that rise out of the bowl once the last category is inside, fanned out above it.
const CHIPS = [
  { key: "categories", Icon: IconGrid, angle: 158 },
  { key: "near", Icon: IconPin, angle: 122 },
  { key: "unlock", Icon: IconLock, angle: 58 },
  { key: "approval", Icon: IconCheck, angle: 22 }
];
const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  x: ((i * 37) % 100) - 50,
  drift: ((i * 53) % 90) - 45,
  delay: (i * 0.37) % 4,
  dur: 3 + ((i * 7) % 30) / 10,
  size: 3 + (i % 4)
}));

const initial = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

// Back half of the bowl: glow, the open mouth and its dark inside. The tiles are drawn on top of this...
function BowlBack() {
  return (
    <svg viewBox={`0 0 ${BOWL_W} ${BOWL_H}`} className="ho-bowl-svg" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="gbRimGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(600 148) rotate(90) scale(58 300)">
          <stop stopColor="#FFE082" />
          <stop offset="0.55" stopColor="#FFBF1E" />
          <stop offset="1" stopColor="#FFBF1E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gbBody" x1="600" y1="192" x2="600" y2="466" gradientUnits="userSpaceOnUse">
          <stop stopColor="#133270" />
          <stop offset="0.55" stopColor="#08162E" />
          <stop offset="1" stopColor="#030A16" />
        </linearGradient>
        <linearGradient id="gbGold" x1="243" y1="149" x2="955" y2="335" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE28A" />
          <stop offset="0.4" stopColor="#FFC931" />
          <stop offset="1" stopColor="#D99800" />
        </linearGradient>
        <filter id="gbShadow" x="123" y="96" width="954" height="398" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="30" stdDeviation="28" floodColor="#000814" floodOpacity="0.45" />
        </filter>
        <mask id="gbHole" maskUnits="userSpaceOnUse" x="0" y="0" width={BOWL_W} height={BOWL_H}>
          <rect width={BOWL_W} height={BOWL_H} fill="white" />
          <ellipse cx="600" cy={MOUTH_Y} rx="288" ry="48" fill="black" />
        </mask>
      </defs>
      <ellipse cx="600" cy="176" rx="278" ry="58" fill="url(#gbRimGlow)" />
      <ellipse cx="600" cy={MOUTH_Y} rx="342" ry="70" fill="rgba(10,26,56,0.92)" stroke="url(#gbGold)" strokeWidth="14" />
      <ellipse cx="600" cy={MOUTH_Y} rx="288" ry="48" fill="rgba(4,15,31,0.95)" stroke="rgba(255,201,49,0.35)" strokeWidth="8" />
      <ellipse cx="600" cy="456" rx="220" ry="28" fill="rgba(255,191,30,0.25)" />
    </svg>
  );
}

// ...and the front half sits over them: anything that drops below the lip disappears inside the bowl.
function BowlFront() {
  return (
    <svg viewBox={`0 0 ${BOWL_W} ${BOWL_H}`} className="ho-bowl-svg" aria-hidden="true" focusable="false">
      <g filter="url(#gbShadow)">
        <g mask="url(#gbHole)">
          <path d="M258 182C265 302 375 424 600 424C825 424 935 302 942 182H258Z" fill="url(#gbBody)" />
        </g>
        <path d="M258 182C265 302 375 424 600 424C825 424 935 302 942 182" stroke="url(#gbGold)" strokeWidth="12" strokeLinecap="round" fill="none" />
        <path d={`M258 ${MOUTH_Y}A342 70 0 0 0 942 ${MOUTH_Y}`} stroke="url(#gbGold)" strokeWidth="14" strokeLinecap="round" fill="none" />
        <path d={`M312 ${MOUTH_Y}A288 48 0 0 0 888 ${MOUTH_Y}`} stroke="rgba(255,201,49,0.35)" strokeWidth="8" fill="none" />
        <path d="M390 281C456 316 520 334 600 334C680 334 744 316 810 281" stroke="rgba(255,201,49,0.28)" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d="M342 232C420 282 498 306 600 306C702 306 780 282 858 232" stroke="rgba(255,201,49,0.18)" strokeWidth="6" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

// The categories ring the search box like an orbit. Scrolling drops them one by one into the Gabla bowl
// (and scrolling back up lifts them out again onto the ring), then the statement lights up above it.
// Everything is positioned from one scroll-driven loop.
export default function OrbitStage({ categories, searchValue, onSearchChange }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const stickyRef = useRef(null);
  const heroRef = useRef(null);
  const hintRef = useRef(null);
  const endRef = useRef(null);
  const subRef = useRef(null);
  const beamRef = useRef(null);
  const sparksRef = useRef(null);
  const chipRefs = useRef([]);
  const trailRefs = useRef([]);
  const bowlBackRef = useRef(null);
  const bowlFrontRef = useRef(null);
  const bowlGlowRef = useRef(null);
  const tileRefs = useRef([]);
  const wordRefs = useRef([]);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0, hdr: 76 });

  const tiles = useMemo(() => categories.slice(0, MAX_TILES), [categories]);
  const endWords = useMemo(() => [...t("landing.endTitle1").split(/\s+/), ...t("landing.endTitle2").split(/\s+/)].filter(Boolean), [t]);
  const lineBreakAt = useMemo(() => t("landing.endTitle1").split(/\s+/).filter(Boolean).length, [t]);

  useEffect(() => {
    const node = stickyRef.current;
    if (!node) return undefined;
    const update = () => {
      const header = document.querySelector(".site-header");
      setSize({ w: node.clientWidth, h: node.clientHeight, hdr: header ? header.offsetHeight : 76 });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // Bowl placement: centred along the bottom of the stage, its visible base 20px above the edge.
  const bowl = useMemo(() => {
    const bw = Math.min(size.w * 0.46, 640, size.h * 1.45);
    const bh = (bw * BOWL_H) / BOWL_W;
    return { bw, bh, left: (size.w - bw) / 2, top: size.h - bh * 0.9 - 20 };
  }, [size]);

  // Where each chip comes to rest, and the curved path of light it follows out of the bowl's mouth.
  const chipGeo = useMemo(() => {
    const mx = size.w / 2;
    const my = bowl.top + (MOUTH_Y / BOWL_H) * bowl.bh;
    const ax = mx;
    const ay = my - bowl.bh * 0.1;
    const rx = Math.min(size.w * 0.34, 430);
    const ry = Math.min(size.h * 0.3, 210);
    return CHIPS.map((c) => {
      const rad = (c.angle * Math.PI) / 180;
      const tx = ax + rx * Math.cos(rad);
      const ty = ay - ry * Math.sin(rad);
      const cxp = mx + (tx - mx) * 0.15;
      const cyp = Math.min(my, ty) - 90;
      return { mx, my, tx, ty, cxp, cyp, d: `M${mx.toFixed(1)} ${my.toFixed(1)} Q${cxp.toFixed(1)} ${cyp.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}` };
    });
  }, [size, bowl]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !size.w) return undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cx = size.w / 2;
    const cy = size.h / 2 - 16;
    const rx = Math.min(size.w * 0.38, 600);
    const ry = Math.min(size.h * 0.35, 320);
    const n = tiles.length;
    const mouthX = bowl.left + bowl.bw / 2;
    const mouthRestY = bowl.top + (MOUTH_Y / BOWL_H) * bowl.bh;
    // Tiles drop in a scrambled order (golden-ratio steps) so neighbours do not all go at once.
    const order = tiles.map((_, i) => (i * 0.6180339887) % 1);

    let raf = 0;
    let last = performance.now();
    let angle = 0;
    let speed = 1;
    let pull = 0;
    let visible = true;

    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: "120px" });
    observer.observe(section);

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!visible) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const targetSpeed = reduce ? 0 : hoverRef.current ? 0 : focusRef.current ? 0.3 : 1;
      speed += (targetSpeed - speed) * Math.min(1, dt * 5);
      angle += (dt * speed * TAU) / ORBIT_SECONDS;
      pull += ((focusRef.current ? 1 : 0) - pull) * Math.min(1, dt * 4);

      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, rect.height - size.h);
      const p = clamp((size.hdr - rect.top) / travel);

      // The bowl rises into view from below the edge as the first tiles start to fall.
      const rise = 1 - smooth(p, 0.02, 0.16);
      const lift = rise * bowl.bh * 1.15;
      const bowlOpacity = smooth(p, 0.02, 0.1);
      for (const ref of [bowlBackRef, bowlFrontRef]) {
        const el = ref.current;
        if (!el) continue;
        el.style.transform = `translate3d(0, ${lift.toFixed(1)}px, 0)`;
        el.style.opacity = bowlOpacity.toFixed(3);
      }
      if (bowlGlowRef.current) bowlGlowRef.current.style.opacity = (bowlOpacity * (0.4 + 0.6 * smooth(p, 0.1, 0.55))).toFixed(3);
      const mouthY = mouthRestY + lift;

      const open = 1 + 0.06 * smooth(p, 0, 0.1) - 0.05 * pull;
      for (let i = 0; i < n; i += 1) {
        const el = tileRefs.current[i];
        if (!el) continue;
        const a = angle + (i / n) * TAU - Math.PI / 2;
        const depthOnRing = (Math.sin(a) + 1) / 2;
        const ox = cx + rx * open * Math.cos(a);
        const oy = cy + ry * open * Math.sin(a);
        const os = 0.88 + 0.12 * depthOnRing;

        // Each tile has its own slot in the scroll: it leaves the ring, falls with gravity, shrinks and tumbles
        // towards the mouth, then sinks behind the front lip.
        const start = 0.08 + 0.28 * order[i];
        const f = clamp((p - start) / 0.22);
        const sideways = smooth(f, 0, 1);
        const gravity = Math.pow(f, 2.1);
        const x = lerp(ox, mouthX, sideways);
        let y = lerp(oy, mouthY, gravity);
        y += smooth(f, 0.78, 1) * bowl.bh * 0.36;
        const s = lerp(os, 0.32, Math.pow(f, 0.8));
        const spin = (i % 2 ? 1 : -1) * 30 * f;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${spin.toFixed(1)}deg) scale(${s.toFixed(3)})`;
        el.style.opacity = f > 0 ? "1" : (0.82 + 0.18 * depthOnRing).toFixed(3);
        el.style.zIndex = String(Math.round(depthOnRing * 10));
        el.style.pointerEvents = f > 0 ? "none" : "auto";
        el.style.visibility = f >= 1 ? "hidden" : "visible";
      }

      const hero = heroRef.current;
      if (hero) {
        const fade = smooth(p, 0.04, 0.2);
        hero.style.opacity = String(1 - fade);
        hero.style.transform = `translateY(${(-36 * fade).toFixed(1)}px)`;
        hero.style.visibility = fade > 0.98 ? "hidden" : "visible";
      }
      if (hintRef.current) hintRef.current.style.opacity = String(1 - smooth(p, 0, 0.06));

      // Once the last category is inside, the bowl lights up: a beam and sparks rise, the headline lights word by
      // word, and the key points rise out one by one along trails of light.
      const lit = smooth(p, 0.5, 0.62);
      if (beamRef.current) beamRef.current.style.opacity = lit.toFixed(3);
      if (sparksRef.current) sparksRef.current.style.opacity = lit.toFixed(3);
      if (endRef.current) endRef.current.style.opacity = String(smooth(p, 0.5, 0.56));
      const reveal = clamp((p - 0.54) / 0.2);
      const total = wordRefs.current.length;
      for (let i = 0; i < total; i += 1) {
        const w = wordRefs.current[i];
        if (w) w.style.opacity = (0.14 + 0.86 * clamp(reveal * (total + 2) - i)).toFixed(3);
      }
      if (subRef.current) {
        const subIn = smooth(p, 0.66, 0.76);
        subRef.current.style.opacity = subIn.toFixed(3);
        subRef.current.style.transform = `translateY(${((1 - subIn) * 14).toFixed(1)}px)`;
      }
      for (let j = 0; j < CHIPS.length; j += 1) {
        const geo = chipGeo[j];
        const chip = chipRefs.current[j];
        const trail = trailRefs.current[j];
        if (!geo || !chip) continue;
        const g = clamp((p - (0.56 + 0.06 * j)) / 0.14);
        const e = 1 - Math.pow(1 - g, 3);
        const x = (1 - e) * (1 - e) * geo.mx + 2 * (1 - e) * e * geo.cxp + e * e * geo.tx;
        const y = (1 - e) * (1 - e) * geo.my + 2 * (1 - e) * e * geo.cyp + e * e * geo.ty;
        chip.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${(0.25 + 0.75 * e).toFixed(3)})`;
        chip.style.opacity = smooth(g, 0, 0.2).toFixed(3);
        chip.style.visibility = g <= 0 ? "hidden" : "visible";
        if (trail) {
          trail.style.strokeDasharray = `${e.toFixed(3)} 1`;
          trail.style.opacity = (g <= 0 ? 0 : 1 - 0.78 * smooth(g, 0.8, 1)).toFixed(3);
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [tiles, bowl, size, chipGeo]);

  const submit = (event) => {
    event.preventDefault();
    const trimmed = searchValue.trim();
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  // Phone-width screens use the mobile home instead, so tile size only has to suit tablets and up.
  const tileW = clamp(Math.min(size.w, size.h * 1.5) * 0.075, 56, 92);
  const bowlStyle = { left: bowl.left, top: bowl.top, width: bowl.bw, height: bowl.bh };

  return (
    <section className="ho" ref={sectionRef} aria-label={t("landing.orbitAria")}>
      <div className="ho-sticky" ref={stickyRef} style={{ "--tw": `${tileW}px`, "--th": `${tileW * 1.22}px` }}>
        <div className="ho-glow" aria-hidden="true" />
        <div
          className="ho-bowl-glow"
          ref={bowlGlowRef}
          aria-hidden="true"
          style={{ left: bowl.left - bowl.bw * 0.15, top: bowl.top - bowl.bh * 0.2, width: bowl.bw * 1.3, height: bowl.bh * 1.2 }}
        />

        <div className="ho-bowl ho-bowl-back" ref={bowlBackRef} style={bowlStyle}><BowlBack /></div>

        <div className="ho-tiles">
          {tiles.map((cat, i) => (
            <Link
              key={cat.id}
              ref={(el) => { tileRefs.current[i] = el; }}
              to={`/category/${cat.id}`}
              className="ho-tile"
              aria-label={t("landing.openCategory", { name: cat.name })}
              onMouseEnter={() => { hoverRef.current = true; }}
              onMouseLeave={() => { hoverRef.current = false; }}
              onFocus={() => { hoverRef.current = true; }}
              onBlur={() => { hoverRef.current = false; }}
            >
              <span className="ho-tile-card">
                {cat.image ? <img src={cat.image} alt="" loading="lazy" draggable="false" /> : <span className="ho-tile-initial">{initial(cat.name)}</span>}
              </span>
              <span className="ho-tile-name">{cat.name}</span>
            </Link>
          ))}
        </div>

        <div className="ho-bowl ho-bowl-front" ref={bowlFrontRef} style={bowlStyle}><BowlFront /></div>

        <div className="ho-hero" ref={heroRef}>
          <span className="home-eyebrow">
            <IconSparkles /> {t("landing.eyebrow")}
          </span>
          <h1 className="ho-title">
            {t("landing.titleLine1")}
            <br />
            <span className="home-gradient-text">{t("landing.titleLine2")}</span>
          </h1>

          <form className="ho-search" onSubmit={submit}>
            <span className="ho-search-icon"><IconSearch /></span>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => { focusRef.current = true; }}
              onBlur={() => { focusRef.current = false; }}
              placeholder={t("landing.searchPlaceholder")}
              aria-label={t("landing.searchPlaceholder")}
            />
            <button type="submit" className="ho-search-go">{t("landing.searchButton")} <IconArrowRight /></button>
          </form>

          <div className="ho-also">
            <span>{t("landing.alsoOn")}</span>
            <Link to="/shop"><IconCart /> {t("landing.shop")}</Link>
            <Link to="/ride"><IconCar /> {t("landing.ride")}</Link>
            <Link to="/bus"><IconBus /> {t("landing.bus")}</Link>
          </div>
        </div>

        <div className="ho-beam" ref={beamRef} aria-hidden="true" style={{ left: bowl.left + bowl.bw / 2, top: bowl.top + (MOUTH_Y / BOWL_H) * bowl.bh, width: bowl.bw * 0.62, height: size.h * 0.62 }} />
        <div className="ho-sparks" ref={sparksRef} aria-hidden="true" style={{ left: bowl.left + bowl.bw / 2, top: bowl.top + (MOUTH_Y / BOWL_H) * bowl.bh, "--spread": `${bowl.bw * 0.5}px`, "--rise": `${size.h * 0.55}px` }}>
          {SPARKS.map((sp, i) => (
            <i key={i} style={{ "--x": `${sp.x * 0.01}`, "--drift": `${sp.drift}px`, animationDelay: `${sp.delay}s`, animationDuration: `${sp.dur}s`, width: sp.size, height: sp.size }} />
          ))}
        </div>

        <svg className="ho-trails" width={size.w} height={size.h} aria-hidden="true">
          <defs>
            <linearGradient id="hoTrail" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#facc15" stopOpacity="0" />
              <stop offset="1" stopColor="#f59e0b" stopOpacity="0.95" />
            </linearGradient>
          </defs>
          {chipGeo.map((geo, j) => (
            <path key={CHIPS[j].key} ref={(el) => { trailRefs.current[j] = el; }} d={geo.d} pathLength="1" className="ho-trail" />
          ))}
        </svg>

        <div className="ho-chips">
          {CHIPS.map(({ key, Icon }, j) => (
            <div key={key} className="ho-chip" ref={(el) => { chipRefs.current[j] = el; }}>
              <span className="ho-chip-in" style={{ animationDelay: `${j * 0.6}s` }}>
                <span className="ho-chip-icon"><Icon /></span>
                <strong>{t(`landing.chips.${key}.title`)}</strong>
                <small>{t(`landing.chips.${key}.sub`)}</small>
              </span>
            </div>
          ))}
        </div>

        <div className="ho-end" ref={endRef}>
          <h2 className="ho-end-title">
            {endWords.map((word, i) => (
              <React.Fragment key={`${word}-${i}`}>
                {i === lineBreakAt ? <br /> : null}
                <span className={i >= lineBreakAt ? "home-gradient-text" : undefined} ref={(el) => { wordRefs.current[i] = el; }}>{word}{" "}</span>
              </React.Fragment>
            ))}
          </h2>
          <p ref={subRef}>{t("landing.endSub")}</p>
        </div>

        <div className="ho-hint" ref={hintRef} aria-hidden="true">
          <span>{t("landing.scrollHint")}</span>
          <i />
        </div>
      </div>
    </section>
  );
}
