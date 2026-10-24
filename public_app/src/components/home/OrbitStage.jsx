import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { IconArrowRight, IconBus, IconCar, IconCart, IconSearch, IconSparkles } from "../icons";

const MAX_TILES = 16;
const ORBIT_SECONDS = 70;
const TAU = Math.PI * 2;

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (v, a, b) => {
  const x = clamp((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const lerp = (a, b, t) => a + (b - a) * t;

// Same layout every render: a seeded generator, so tiles do not jump when the page re-renders.
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const initial = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

// The categories ring the search box like an orbit; scrolling pulls them apart into a field of floating
// tiles while the statement lights up word by word. Everything is positioned from one scroll-driven loop.
export default function OrbitStage({ categories, searchValue, onSearchChange }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const stickyRef = useRef(null);
  const heroRef = useRef(null);
  const hintRef = useRef(null);
  const manifestoRef = useRef(null);
  const tileRefs = useRef([]);
  const wordRefs = useRef([]);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0, hdr: 76 });

  const tiles = useMemo(() => categories.slice(0, MAX_TILES), [categories]);
  const words = useMemo(() => t("landing.manifesto").split(/\s+/).filter(Boolean), [t]);

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

  // Where each tile drifts to once the ring breaks apart. Mostly clear of the statement in the middle,
  // with a few passing behind it; far ones are smaller and fainter.
  const scatter = useMemo(() => {
    const { w, h } = size;
    const rand = seeded(7);
    const boxW = Math.min(460, w * 0.4);
    const boxH = 170;
    return tiles.map((_, i) => {
      let x = w / 2;
      let y = h / 2;
      for (let tries = 0; tries < 14; tries += 1) {
        x = 50 + rand() * Math.max(1, w - 100);
        y = 60 + rand() * Math.max(1, h - 120);
        const clearOfText = Math.abs(x - w / 2) > boxW || Math.abs(y - h / 2) > boxH;
        if (clearOfText || i % 6 === 0) break;
      }
      const depth = rand();
      return { x, y, scale: 0.55 + depth * 0.7, opacity: 0.45 + depth * 0.55, depth };
    });
  }, [tiles, size]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !size.w) return undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cx = size.w / 2;
    const cy = size.h / 2 - 16;
    const rx = Math.min(size.w * 0.38, 600);
    const ry = Math.min(size.h * 0.35, 320);
    const n = tiles.length;

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
      const breakApart = smooth(p, 0.1, 0.42);
      const open = 1 + 0.12 * smooth(p, 0, 0.2) - 0.05 * pull;

      for (let i = 0; i < n; i += 1) {
        const el = tileRefs.current[i];
        if (!el) continue;
        const a = angle + (i / n) * TAU - Math.PI / 2;
        const depthOnRing = (Math.sin(a) + 1) / 2;
        const ox = cx + rx * open * Math.cos(a);
        const oy = cy + ry * open * Math.sin(a);
        const os = 0.88 + 0.12 * depthOnRing;
        const target = scatter[i] || { x: ox, y: oy, scale: 1, opacity: 1, depth: 0.5 };
        const x = lerp(ox, target.x, breakApart);
        const y = lerp(oy, target.y, breakApart);
        const s = lerp(os, target.scale, breakApart);
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${s.toFixed(3)})`;
        el.style.opacity = lerp(0.82 + 0.18 * depthOnRing, target.opacity, breakApart).toFixed(3);
        el.style.zIndex = String(Math.round(lerp(depthOnRing, target.depth, breakApart) * 10));
      }

      const hero = heroRef.current;
      if (hero) {
        const fade = smooth(p, 0.06, 0.26);
        hero.style.opacity = String(1 - fade);
        hero.style.transform = `translateY(${(-36 * fade).toFixed(1)}px)`;
        hero.style.visibility = fade > 0.98 ? "hidden" : "visible";
      }
      if (hintRef.current) hintRef.current.style.opacity = String(1 - smooth(p, 0, 0.08));

      if (manifestoRef.current) manifestoRef.current.style.opacity = String(smooth(p, 0.3, 0.4));
      const reveal = clamp((p - 0.4) / 0.5);
      const total = wordRefs.current.length;
      for (let i = 0; i < total; i += 1) {
        const w = wordRefs.current[i];
        if (w) w.style.opacity = (0.16 + 0.84 * clamp(reveal * (total + 5) - i)).toFixed(3);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [tiles, scatter, size]);

  const submit = (event) => {
    event.preventDefault();
    const trimmed = searchValue.trim();
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  // Phone-width screens use the mobile home instead, so tile size only has to suit tablets and up.
  const tileW = clamp(Math.min(size.w, size.h * 1.5) * 0.075, 56, 92);

  return (
    <section className="ho" ref={sectionRef} aria-label={t("landing.orbitAria")}>
      <div className="ho-sticky" ref={stickyRef} style={{ "--tw": `${tileW}px`, "--th": `${tileW * 1.22}px` }}>
        <div className="ho-glow" aria-hidden="true" />

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

        <div className="ho-manifesto" ref={manifestoRef}>
          <p>
            {words.map((word, i) => (
              <span key={`${word}-${i}`} ref={(el) => { wordRefs.current[i] = el; }}>{word}{" "}</span>
            ))}
          </p>
        </div>

        <div className="ho-hint" ref={hintRef} aria-hidden="true">
          <span>{t("landing.scrollHint")}</span>
          <i />
        </div>
      </div>
    </section>
  );
}
