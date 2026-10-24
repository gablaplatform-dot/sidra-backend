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

// Scroll budget. The first part runs orbit -> bowl -> beam; every chapter after that glides the bowl to a side
// (left, right, left...) and pops that chapter's cards out of it on the opposite side.
const PHASE1 = 0.313;
const CH_LEN = 0.229;
const CHAPTERS = [
  { key: "shop", side: "left", to: "/shop", eyebrow: "home.promo.shopEyebrow", title: "landing.story.shopTitle", sub: "home.promo.shopText", cta: "home.promo.shopCta" },
  { key: "bus", side: "right", to: "/bus", eyebrow: "home.bus.eyebrow", title: "home.bus.title", sub: "home.bus.text", cta: "home.bus.findBuses" },
  { key: "ride", side: "left", to: "/ride", eyebrow: "home.promo.rideEyebrow", title: "home.promo.rideTitle", sub: "home.promo.rideText", cta: "home.promo.rideCta" }
];
const BOWL_SIDE_SCALE = 0.78;

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

// The categories ring the search box like an orbit. Scrolling drops them one by one into the Gabla bowl
// (and scrolling back up lifts them out again onto the ring), then the statement lights up above it.
// Everything is positioned from one scroll-driven loop.
export default function OrbitStage({ categories, shopCards = [], busRoutes = [], searchValue, onSearchChange }) {
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
  const sideRefs = useRef([]);
  const cardRefs = useRef({});
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
    const sideDx = CHAPTERS.map((c) => (c.side === "left" ? size.w * 0.24 : size.w * 0.76) - mouthX);

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
      const pAll = clamp((size.hdr - rect.top) / travel);
      const p = clamp(pAll / PHASE1);

      // Chapters: cu runs 0..3 across shop, bus and ride. The bowl glides to each chapter's side.
      const cu = (pAll - PHASE1) / CH_LEN;
      const ci = clamp(Math.floor(cu), 0, CHAPTERS.length - 1);
      let dx = 0;
      let sc = 1;
      if (cu >= 0) {
        const u = clamp(cu - ci, 0, 1);
        const prevX = ci === 0 ? 0 : sideDx[ci - 1];
        const prevS = ci === 0 ? 1 : BOWL_SIDE_SCALE;
        const glide = smooth(u, 0.1, 0.3);
        dx = lerp(prevX, sideDx[ci], glide);
        sc = lerp(prevS, BOWL_SIDE_SCALE, glide);
      }
      // The end-state scene (beam, sparks, headline, chips) hands over to chapter one.
      const leave = cu < 0 ? 0 : cu >= 1 ? 1 : smooth(cu, 0, 0.09);

      // The bowl rises into view from below the edge as the first tiles start to fall.
      const rise = 1 - smooth(p, 0.02, 0.16);
      const lift = rise * bowl.bh * 1.15;
      const bowlOpacity = smooth(p, 0.02, 0.1);
      for (const ref of [bowlBackRef, bowlFrontRef]) {
        const el = ref.current;
        if (!el) continue;
        el.style.transform = `translate3d(${dx.toFixed(1)}px, ${lift.toFixed(1)}px, 0) scale(${sc.toFixed(3)})`;
        el.style.opacity = bowlOpacity.toFixed(3);
      }
      if (bowlGlowRef.current) {
        bowlGlowRef.current.style.opacity = (bowlOpacity * (0.4 + 0.6 * smooth(p, 0.1, 0.55))).toFixed(3);
        bowlGlowRef.current.style.translate = `${dx.toFixed(1)}px 0`;
        bowlGlowRef.current.style.scale = sc.toFixed(3);
      }
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
      if (beamRef.current) beamRef.current.style.opacity = (lit * (1 - leave)).toFixed(3);
      if (sparksRef.current) sparksRef.current.style.opacity = (lit * (1 - leave)).toFixed(3);
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

      // Each chapter: its words fade in beside the bowl, then its cards pop out of the mouth one by one and, when
      // the chapter ends, drop back in before the bowl glides to the other side.
      const mx = mouthX + dx;
      for (let k = 0; k < CHAPTERS.length; k += 1) {
        const last = k === CHAPTERS.length - 1;
        const uk = cu - k;
        const side = sideRefs.current[k];
        if (side) {
          const tin = smooth(uk, 0.24, 0.38);
          const o = tin * (last ? 1 : 1 - smooth(uk, 0.9, 0.97));
          side.style.opacity = o.toFixed(3);
          side.style.transform = `translateY(${((1 - tin) * 18).toFixed(1)}px)`;
          side.style.visibility = o <= 0.01 ? "hidden" : "visible";
          side.style.pointerEvents = o > 0.6 ? "auto" : "none";
        }
        const geos = cardGeo[k] || [];
        for (let j = 0; j < geos.length; j += 1) {
          const el = cardRefs.current[`${k}-${j}`];
          if (!el) continue;
          let g = clamp((uk - (0.3 + 0.06 * j)) / 0.12);
          if (!last) g *= 1 - smooth(uk, 0.88 + 0.02 * j, 0.95 + 0.02 * j);
          const e = 1 - Math.pow(1 - g, 3);
          const tx = geos[j].x;
          const ty = geos[j].y;
          const cxp = mx + (tx - mx) * 0.25;
          const cyp = Math.min(mouthY, ty) - 100;
          const x = (1 - e) * (1 - e) * mx + 2 * (1 - e) * e * cxp + e * e * tx;
          const y = (1 - e) * (1 - e) * mouthY + 2 * (1 - e) * e * cyp + e * e * ty;
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
  }, [tiles, bowl, size, chipGeo, cardGeo]);

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

        {CHAPTERS.map((chapter, k) => (
          <div key={chapter.key} className={`ho-side ho-side-${chapter.side}`} ref={(el) => { sideRefs.current[k] = el; }}>
            <span className="home-eyebrow">{t(chapter.eyebrow)}</span>
            <h2>{t(chapter.title)}</h2>
            <p>{t(chapter.sub)}</p>
            <Link to={chapter.to} className="ho-side-cta">{t(chapter.cta)} <IconArrowRight /></Link>
          </div>
        ))}

        <div className="ho-hint" ref={hintRef} aria-hidden="true">
          <span>{t("landing.scrollHint")}</span>
          <i />
        </div>
      </div>
    </section>
  );
}
