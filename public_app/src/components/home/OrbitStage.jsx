import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { todayEat, ugx } from "../../lib/bus";
import { IconArrowRight, IconBike, IconBus, IconCar, IconCart, IconCheck, IconGrid, IconLock, IconPin, IconSearch, IconSparkles, IconTicket } from "../icons";

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

// Cubic-bezier easing (same maths as CSS): a quick start and a long, soft landing. Everything that moves uses it.
const cubicBezier = (x1, y1, x2, y2) => {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i += 1) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-4) break;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return sampleY(clamp(t));
  };
};
const ease = cubicBezier(0.2, 0.9, 0.25, 1);

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

// Scroll budget, in screens. Block 0 (orbit -> bowl -> beam) pins for PINS[0]. Every chapter is then its own
// block: it slides in from below as the page really scrolls, pins while its cards pop out, hold and drop back
// into the bowl, and slides away as the next one arrives. The bowl crosses and drops with the page between them.
const PINS = [3.0, 1.4, 1.4, 1.0];
const CHAPTERS = [
  { key: "shop", side: "left", to: "/shop", eyebrow: "home.promo.shopEyebrow", title: "landing.story.shopTitle", sub: "home.promo.shopText", cta: "home.promo.shopCta" },
  { key: "bus", side: "right", to: "/bus", eyebrow: "home.bus.eyebrow", title: "home.bus.title", sub: "home.bus.text", cta: "home.bus.findBuses" },
  { key: "ride", side: "left", to: "/ride", eyebrow: "home.promo.rideEyebrow", title: "home.promo.rideTitle", sub: "home.promo.rideText", cta: "home.promo.rideCta" }
];
const BOWL_SIDE_SCALE = 0.78;
const HDR_FALLBACK = 76;

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

const renderCard = (card, t) => {
  if (card.kind === "product" || card.kind === "category") {
    return (
      <>
        <span className="ho-card-img" style={card.image ? { backgroundImage: `url("${card.image}")` } : undefined}>
          {!card.image ? <b>{initial(card.name)}</b> : null}
        </span>
        <span className="ho-card-body">
          <strong>{card.name}</strong>
          {card.price ? <em>{card.price}</em> : <em>{t("landing.story.browse")}</em>}
        </span>
      </>
    );
  }
  if (card.kind === "route") {
    return (
      <>
        <span className="ho-ticket-top"><IconBus /> <b>{card.from}</b></span>
        <span className="ho-ticket-arrow">&darr;</span>
        <span className="ho-ticket-top"><IconPin /> <b>{card.toPlace}</b></span>
        <span className="ho-ticket-foot">{card.price ? t("landing.story.fromPrice", { price: card.price }) : t("home.bus.findBuses")}</span>
      </>
    );
  }
  const Icon = card.icon === "bike" ? IconBike : card.icon === "car" ? IconCar : card.icon === "ticket" ? IconTicket : IconBus;
  return (
    <>
      <span className="ho-card-icon"><Icon /></span>
      <strong>{card.title || card.label}</strong>
      {card.sub ? <small>{card.sub}</small> : null}
    </>
  );
};

// The categories ring the search box like an orbit. Scrolling drops them one by one into the Gabla bowl, then the
// bowl travels down the page, section by section, crossing left and right, taking each chapter's cards in as it
// leaves and popping the next chapter's out as it lands. Everything is positioned from one scroll-driven loop.
export default function OrbitStage({ categories, shopCards = [], busRoutes = [], searchValue, onSearchChange }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const storyRef = useRef(null);
  const heroRef = useRef(null);
  const hintRef = useRef(null);
  const endRef = useRef(null);
  const subRef = useRef(null);
  const beamRef = useRef(null);
  const sparksRef = useRef(null);
  const glowRef = useRef(null);
  const chipRefs = useRef([]);
  const trailRefs = useRef([]);
  const cardRefs = useRef({});
  const bowlBackRef = useRef(null);
  const bowlFrontRef = useRef(null);
  const bowlGlowRef = useRef(null);
  const tileRefs = useRef([]);
  const wordRefs = useRef([]);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  const [size, setSize] = useState(() => ({
    w: typeof window === "undefined" ? 1280 : document.documentElement.clientWidth,
    h: typeof window === "undefined" ? 700 : window.innerHeight - HDR_FALLBACK,
    hdr: HDR_FALLBACK
  }));

  const tiles = useMemo(() => categories.slice(0, MAX_TILES), [categories]);
  const endWords = useMemo(() => [...t("landing.endTitle1").split(/\s+/), ...t("landing.endTitle2").split(/\s+/)].filter(Boolean), [t]);
  const lineBreakAt = useMemo(() => t("landing.endTitle1").split(/\s+/).filter(Boolean).length, [t]);

  // Cards each chapter pops out. Bus falls back to two plain actions while no routes are published yet.
  const chapterCards = useMemo(() => {
    const bus = busRoutes.slice(0, 4).map((r) => ({
      kind: "route",
      id: `${r.from}-${r.to}`,
      to: `/bus/search?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}&date=${todayEat()}`,
      from: r.from,
      toPlace: r.to,
      price: r.minPrice ? ugx(r.minPrice) : null
    }));
    return {
      shop: shopCards.slice(0, 4),
      bus: bus.length
        ? bus
        : [
            { kind: "action", id: "buses", to: "/bus", icon: "bus", label: t("home.bus.findBuses") },
            { kind: "action", id: "tickets", to: "/bus/tickets", icon: "ticket", label: t("home.bus.myTickets") }
          ],
      ride: [
        { kind: "ride", id: "boda", to: "/ride", icon: "bike", title: t("landing.story.boda"), sub: t("landing.story.bodaSub") },
        { kind: "ride", id: "car", to: "/ride", icon: "car", title: t("landing.story.car"), sub: t("landing.story.carSub") }
      ]
    };
  }, [shopCards, busRoutes, t]);

  useEffect(() => {
    const update = () => {
      const header = document.querySelector(".site-header");
      const hdr = header ? header.offsetHeight : HDR_FALLBACK;
      setSize({ w: document.documentElement.clientWidth, h: window.innerHeight - hdr, hdr });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Block geometry in story coordinates: T is where a block starts, P how long its stage stays pinned.
  const blocks = useMemo(() => {
    let top = 0;
    return PINS.map((pin) => {
      const block = { T: top, P: pin * size.h };
      top += block.P + size.h;
      return block;
    });
  }, [size.h]);

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

  // Card size follows the stage, and each chapter's cards sit in a 2x2 (or 1x2) block on the side opposite the bowl.
  const cardBox = useMemo(() => {
    const cw = clamp(Math.min(size.w * 0.19, (size.h - 170) / 2 / 1.22), 130, 232);
    return { cw, ch: cw * 1.22 };
  }, [size]);
  const cardGeo = useMemo(() => {
    const gap = 22;
    return CHAPTERS.map((chapter) => {
      const n = (chapterCards[chapter.key] || []).length;
      const cols = n >= 3 ? 2 : Math.max(1, n);
      const rows = n >= 3 ? 2 : 1;
      const regionX = chapter.side === "left" ? size.w * 0.5 : size.w * 0.04;
      const regionW = size.w * 0.46;
      const totalW = cols * cardBox.cw + (cols - 1) * gap;
      const totalH = rows * cardBox.ch + (rows - 1) * gap + (cols > 1 ? 26 : 0);
      const x0 = regionX + (regionW - totalW) / 2 + cardBox.cw / 2;
      const y0 = size.h / 2 - totalH / 2 + cardBox.ch / 2 - 8;
      return Array.from({ length: n }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return { x: x0 + col * (cardBox.cw + gap), y: y0 + row * (cardBox.ch + gap) + (col ? 26 : 0) };
      });
    });
  }, [size, cardBox, chapterCards]);

  useEffect(() => {
    const story = storyRef.current;
    if (!story || !size.w) return undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cx = size.w / 2;
    const cy = size.h / 2 - 16;
    const rx = Math.min(size.w * 0.38, 600);
    const ry = Math.min(size.h * 0.35, 320);
    const n = tiles.length;
    const mouthX = bowl.left + bowl.bw / 2;
    const mouthStageY = bowl.top + (MOUTH_Y / BOWL_H) * bowl.bh;
    // Tiles drop in a scrambled order (golden-ratio steps) so neighbours do not all go at once.
    const order = tiles.map((_, i) => (i * 0.6180339887) % 1);
    // Bowl anchors per block: centre for the intro, then the side of each chapter (left, right, left).
    const anchorX = [cx, ...CHAPTERS.map((c) => (c.side === "left" ? size.w * 0.24 : size.w * 0.76))];
    const anchorS = [1, BOWL_SIDE_SCALE, BOWL_SIDE_SCALE, BOWL_SIDE_SCALE];
    const arc = size.h * 0.22;

    let raf = 0;
    let last = performance.now();
    let angle = 0;
    let speed = 1;
    let pull = 0;
    let visible = true;

    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: "120px" });
    observer.observe(story);

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

      // v is the story coordinate sitting at the header line; every block's stage sticks while v is inside it.
      const rect = story.getBoundingClientRect();
      const v = size.hdr - rect.top;
      const stageTopOf = (b) => clamp(v, blocks[b].T, blocks[b].T + blocks[b].P);
      const stageTop0 = stageTopOf(0);
      const p = clamp(v / Math.max(1, blocks[0].P));
      // The intro scene (beam, sparks, headline, chips) hands over to the first chapter.
      const leave = smooth(p, 0.93, 1);

      // The bowl rises into view as the first tiles start to fall.
      const rise = 1 - smooth(p, 0.02, 0.16);
      const lift = rise * bowl.bh * 1.15;
      const bowlOpacity = smooth(p, 0.02, 0.1);

      // Where the bowl is: parked at its block's anchor while that block is pinned, and travelling down to the
      // next block's anchor (swooping through the screen) while the page scrolls one block over.
      let bx = cx;
      let by = stageTop0 + mouthStageY + lift;
      let bs = 1;
      let tilt = 0;
      for (let b = 0; b < blocks.length; b += 1) {
        const end = blocks[b].T + blocks[b].P;
        if (v <= end || b === blocks.length - 1) {
          bx = anchorX[b];
          by = stageTopOf(b) + mouthStageY + (b === 0 ? lift : 0);
          bs = anchorS[b];
          break;
        }
        const nextT = blocks[b + 1].T;
        if (v < nextT) {
          const tr = (v - end) / (nextT - end);
          const e = ease(tr);
          bx = lerp(anchorX[b], anchorX[b + 1], e);
          by = lerp(end + mouthStageY, nextT + mouthStageY, e) - arc * Math.sin(Math.PI * e);
          bs = lerp(anchorS[b], anchorS[b + 1], e);
          tilt = Math.sign(anchorX[b + 1] - anchorX[b]) * 14 * Math.sin(Math.PI * e);
          break;
        }
      }
      const dx = bx - mouthX;
      const dy = by - mouthStageY;
      for (const ref of [bowlBackRef, bowlFrontRef]) {
        const el = ref.current;
        if (!el) continue;
        el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${bs.toFixed(3)})`;
        el.style.opacity = bowlOpacity.toFixed(3);
      }
      if (bowlGlowRef.current) {
        bowlGlowRef.current.style.opacity = (bowlOpacity * (0.4 + 0.6 * smooth(p, 0.1, 0.55))).toFixed(3);
        bowlGlowRef.current.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
        bowlGlowRef.current.style.scale = bs.toFixed(3);
      }
      if (glowRef.current) glowRef.current.style.transform = `translate(-50%, calc(-52% + ${(stageTop0 + size.h * 0.5).toFixed(1)}px))`;

      // Intro: tiles ring the search, then fall into the mouth (stage coordinates plus the pinned offset).
      const mouthY = mouthStageY + lift;
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
        const fe = ease(f);
        const x = lerp(ox, mouthX, fe);
        let y = lerp(oy, mouthY, fe);
        y += smooth(fe, 0.8, 1) * bowl.bh * 0.36;
        const s = lerp(os, 0.32, fe);
        const spin = (i % 2 ? 1 : -1) * 30 * fe;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${(y + stageTop0).toFixed(1)}px, 0) translate(-50%, -50%) rotate(${spin.toFixed(1)}deg) scale(${s.toFixed(3)})`;
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
      if (beamRef.current) {
        beamRef.current.style.opacity = (lit * (1 - leave)).toFixed(3);
        beamRef.current.style.translate = `0 ${stageTop0.toFixed(1)}px`;
      }
      if (sparksRef.current) {
        sparksRef.current.style.opacity = (lit * (1 - leave)).toFixed(3);
        sparksRef.current.style.translate = `0 ${stageTop0.toFixed(1)}px`;
      }
      if (endRef.current) endRef.current.style.opacity = (smooth(p, 0.5, 0.56) * (1 - leave)).toFixed(3);
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
        const g = clamp((p - (0.56 + 0.06 * j)) / 0.14) * (1 - leave);
        const e = ease(g);
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

      // Chapters: once the bowl has landed in a block, its cards pop out of the mouth one by one; before the page
      // scrolls on, they drop back in (the last chapter keeps its cards).
      for (let k = 0; k < CHAPTERS.length; k += 1) {
        const b = k + 1;
        const last = k === CHAPTERS.length - 1;
        const q = (v - blocks[b].T) / Math.max(1, blocks[b].P);
        const top = stageTopOf(b);
        const geos = cardGeo[k] || [];
        for (let j = 0; j < geos.length; j += 1) {
          const el = cardRefs.current[`${k}-${j}`];
          if (!el) continue;
          let g = clamp((q - (0.04 + 0.05 * j)) / 0.14);
          if (!last) g *= 1 - smooth(q, 0.72 + 0.03 * j, 0.84 + 0.03 * j);
          const e = ease(g);
          const tx = geos[j].x;
          const ty = top + geos[j].y;
          const cxp = bx + (tx - bx) * 0.25;
          const cyp = Math.min(by, ty) - 100;
          const x = (1 - e) * (1 - e) * bx + 2 * (1 - e) * e * cxp + e * e * tx;
          const y = (1 - e) * (1 - e) * by + 2 * (1 - e) * e * cyp + e * e * ty;
          const rot = (1 - e) * (j % 2 ? 14 : -14);
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${rot.toFixed(1)}deg) scale(${(0.25 + 0.75 * e).toFixed(3)})`;
          el.style.opacity = smooth(g, 0, 0.25).toFixed(3);
          el.style.visibility = g <= 0.001 ? "hidden" : "visible";
          el.style.pointerEvents = g > 0.95 ? "auto" : "none";
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [tiles, bowl, size, blocks, chipGeo, cardGeo]);

  // Nothing should stop half-way. Whenever the scrolling stops between two settled scenes, the page glides on to
  // the nearest one in the direction you were heading, with a fast start and a long soft landing, so a started
  // animation always plays through. Any wheel, touch or key press takes control straight back.
  useEffect(() => {
    const story = storyRef.current;
    if (!story || !size.w || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const [b0, b1, b2, b3] = blocks;
    const beats = [0, b0.P * 0.62, b0.P * 0.92, b1.T + b1.P * 0.42, b2.T + b2.P * 0.42, b3.T + b3.P * 0.62];
    let idle = 0;
    let anim = 0;
    let lastY = window.scrollY;
    let dir = 1;
    let busy = false;

    const storyTop = () => story.getBoundingClientRect().top + window.scrollY;
    const toScroll = (v) => storyTop() + v - size.hdr;
    const currentV = () => size.hdr - story.getBoundingClientRect().top;
    const cancel = () => {
      if (anim) cancelAnimationFrame(anim);
      anim = 0;
      busy = false;
    };

    const glideTo = (targetY) => {
      cancel();
      busy = true;
      const from = window.scrollY;
      const dist = targetY - from;
      const dur = clamp(550 + Math.abs(dist) * 0.8, 700, 1700);
      const t0 = performance.now();
      const step = (now) => {
        const k = clamp((now - t0) / dur);
        window.scrollTo({ top: from + dist * ease(k), behavior: "instant" });
        if (k < 1) anim = requestAnimationFrame(step);
        else {
          anim = 0;
          busy = false;
          lastY = window.scrollY;
        }
      };
      anim = requestAnimationFrame(step);
    };

    const settle = () => {
      if (busy) return;
      const v = currentV();
      if (v < -4 || v > beats[beats.length - 1] + 4) return; // outside the story: leave the page alone
      // The two beats either side of where we stopped.
      let lo = 0;
      while (lo < beats.length - 1 && beats[lo + 1] <= v) lo += 1;
      const hi = Math.min(beats.length - 1, lo + 1);
      if (Math.abs(v - beats[lo]) < 6 || Math.abs(v - beats[hi]) < 6) return; // already settled
      if (hi === lo) return;
      const frac = (v - beats[lo]) / (beats[hi] - beats[lo]);
      // Heading down: finish forwards once a fifth of the way; heading up: finish backwards once a fifth back.
      const forward = dir > 0 ? frac > 0.2 : frac > 0.8;
      glideTo(toScroll(forward ? beats[hi] : beats[lo]));
    };

    const onScroll = () => {
      if (busy) return;
      const y = window.scrollY;
      if (Math.abs(y - lastY) > 0.5) dir = y > lastY ? 1 : -1;
      lastY = y;
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, 140);
    };
    const interrupt = () => {
      if (!busy) return;
      cancel();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("keydown", interrupt);
    window.addEventListener("mousedown", interrupt);
    return () => {
      window.clearTimeout(idle);
      cancel();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchstart", interrupt);
      window.removeEventListener("keydown", interrupt);
      window.removeEventListener("mousedown", interrupt);
    };
  }, [blocks, size]);

  const submit = (event) => {
    event.preventDefault();
    const trimmed = searchValue.trim();
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  // Phone-width screens use the mobile home instead, so tile size only has to suit tablets and up.
  const tileW = clamp(Math.min(size.w, size.h * 1.5) * 0.075, 56, 92);
  const bowlStyle = { left: bowl.left, top: bowl.top, width: bowl.bw, height: bowl.bh };
  const stageStyle = { top: size.hdr, height: size.h };

  return (
    <section className="story" ref={storyRef} aria-label={t("landing.orbitAria")} style={{ "--tw": `${tileW}px`, "--th": `${tileW * 1.22}px` }}>
      {/* Block 0: the orbit, the fall into the bowl and the lit-up scene. */}
      <div className="hb hb-intro" style={{ height: blocks[0].P + size.h }}>
        <div className="hb-stage ho-sticky" style={stageStyle}>
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

          <div className="ho-hint" ref={hintRef} aria-hidden="true">
            <span>{t("landing.scrollHint")}</span>
            <i />
          </div>
        </div>
      </div>

      {/* Blocks 1-3: one section per chapter, each sliding in from below as the page scrolls. */}
      {CHAPTERS.map((chapter, k) => (
        <div key={chapter.key} className={`hb hb-${chapter.key}`} style={{ height: blocks[k + 1].P + size.h }}>
          <div className="hb-stage" style={stageStyle}>
            <div className={`ho-side ho-side-${chapter.side}`}>
              <span className="home-eyebrow">{t(chapter.eyebrow)}</span>
              <h2>{t(chapter.title)}</h2>
              <p>{t(chapter.sub)}</p>
              <Link to={chapter.to} className="ho-side-cta">{t(chapter.cta)} <IconArrowRight /></Link>
            </div>
          </div>
        </div>
      ))}

      {/* The layer the bowl, the tiles and the cards live in: positioned in page coordinates, so the bowl can
          travel from one section to the next while the page scrolls under it. */}
      <div className="story-layer" aria-hidden="false">
        <div className="ho-glow" ref={glowRef} aria-hidden="true" />
        <div
          className="ho-bowl-glow"
          ref={bowlGlowRef}
          aria-hidden="true"
          style={{ left: bowl.left - bowl.bw * 0.15, top: bowl.top - bowl.bh * 0.2, width: bowl.bw * 1.3, height: bowl.bh * 1.2 }}
        />

        <div className="ho-bowl ho-bowl-back" ref={bowlBackRef} style={bowlStyle}><BowlBack /></div>

        <div className="ho-beam" ref={beamRef} aria-hidden="true" style={{ left: bowl.left + bowl.bw / 2, top: bowl.top + (MOUTH_Y / BOWL_H) * bowl.bh, width: bowl.bw * 0.62, height: size.h * 0.62 }} />
        <div className="ho-sparks" ref={sparksRef} aria-hidden="true" style={{ left: bowl.left + bowl.bw / 2, top: bowl.top + (MOUTH_Y / BOWL_H) * bowl.bh, "--spread": `${bowl.bw * 0.5}px`, "--rise": `${size.h * 0.55}px` }}>
          {SPARKS.map((sp, i) => (
            <i key={i} style={{ "--x": `${sp.x * 0.01}`, "--drift": `${sp.drift}px`, animationDelay: `${sp.delay}s`, animationDuration: `${sp.dur}s`, width: sp.size, height: sp.size }} />
          ))}
        </div>

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

        <div className="ho-cards" style={{ "--cw": `${cardBox.cw}px` }}>
          {CHAPTERS.map((chapter, k) =>
            (chapterCards[chapter.key] || []).map((card, j) => (
              <div key={`${chapter.key}-${card.id}`} className="ho-card-pos" ref={(el) => { cardRefs.current[`${k}-${j}`] = el; }}>
                <Link to={card.to} className={`ho-card ho-card-${card.kind}`} style={{ animationDelay: `${(k + j) * 0.5}s` }}>
                  {renderCard(card, t)}
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
