import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { todayEat, ugx } from "../../lib/bus";
import LanguageSwitcher from "../LanguageSwitcher";
import NearbyOverlay from "./NearbyOverlay";
import { BookScreen, FindScreen, UnlockScreen } from "./ContactPhone";
import { IconArrowRight, IconBike, IconChevronLeft, IconBus, IconCar, IconCart, IconPin, IconSearch, IconSparkles, IconTicket } from "../icons";

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

// Scroll budget, in screens. Block 0 (orbit -> bowl -> beam) pins for PINS[0]. Every chapter is then its own
// block: it slides in from below as the page really scrolls, pins while its cards pop out, hold and drop back
// into the bowl, and slides away as the next one arrives. The bowl crosses and drops with the page between them.
const PINS = [3.4, 2.0, 2.0, 2.0, 2.8, 3.0];
const CHAPTERS = [
  { key: "shop", side: "left", to: "/shop", eyebrow: "home.promo.shopEyebrow", title: "landing.story.shopTitle", sub: "home.promo.shopText", cta: "home.promo.shopCta" },
  { key: "bus", side: "right", to: "/bus", eyebrow: "home.bus.eyebrow", title: "home.bus.title", sub: "home.bus.text", cta: "home.bus.findBuses" },
  { key: "ride", side: "left", to: "/ride", eyebrow: "home.promo.rideEyebrow", title: "home.promo.rideTitle", sub: "home.promo.rideText", cta: "home.promo.rideCta" },
  { key: "phone", side: "right", to: "/search", fall: 0.76 },
  // The finale: the categories come back out of the bowl and stay up; the bowl then drops away below them.
  { key: "categories", side: "center", to: "/home#categories", fall: null }
];
// The scenes the "See more" button glides between: each is the moment a section has fully arrived.
const BEAT_NAMES = ["intro", "shop", "bus", "ride", "phone", "categories"];
const RING = 2 * Math.PI * 25;
const PHONE_STEPS = ["find", "unlock", "book"];
const BOWL_SIDE_SCALE = 0.78;
const HDR_FALLBACK = 76;
const COMPACT_W = 760; // below this the story is laid out for a portrait phone

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
  if (card.kind === "tile") {
    return (
      <>
        <span className="ho-tilecard-img" style={card.image ? { backgroundImage: `url("${card.image}")` } : undefined}>
          {!card.image ? <b>{initial(card.name)}</b> : null}
        </span>
        <span className="ho-tilecard-name">{card.name}</span>
      </>
    );
  }
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
export default function OrbitStage({ categories, shopCards = [], categoryCards = [], busRoutes = [], phoneProviders = [], searchValue, onSearchChange }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const storyRef = useRef(null);
  const heroRef = useRef(null);
  const hintRef = useRef(null);
  const glowRef = useRef(null);
  const cardRefs = useRef({});
  const phoneScreenRefs = useRef([]);
  const uiRefs = useRef([]);
  const ringRef = useRef(null);
  const glideRef = useRef(0);
  const [beat, setBeat] = useState(0);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const phoneChipRefs = useRef([]);
  const bowlBackRef = useRef(null);
  const bowlFrontRef = useRef(null);
  const bowlGlowRef = useRef(null);
  const tileRefs = useRef([]);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  const [size, setSize] = useState(() => {
    const w = typeof window === "undefined" ? 1280 : document.documentElement.clientWidth;
    return {
      w,
      h: typeof window === "undefined" ? 700 : window.innerHeight - HDR_FALLBACK,
      hdr: HDR_FALLBACK,
      compact: w < COMPACT_W
    };
  });

  // The ring on larger screens; on a phone, two strips of categories that scroll sideways on their own (in opposite
  // directions), repeated as often as needed to fill the width.
  const tiles = useMemo(() => {
    if (!size.compact) return categories.slice(0, MAX_TILES).map((cat) => ({ cat, key: cat.id }));
    const rows = [[], []];
    categories.slice(0, 12).forEach((c, i) => rows[i % 2].push(c));
    const step = clamp(size.w * 0.22, 72, 104) + 12;
    const need = Math.ceil(size.w / step) + 3;
    const out = [];
    rows.forEach((row, ri) => {
      if (!row.length) return;
      const count = Math.max(need, row.length);
      for (let k = 0; k < count; k += 1) out.push({ cat: row[k % row.length], row: ri, idx: k, key: `${ri}-${k}-${row[k % row.length].id}` });
    });
    return out;
  }, [categories, size.compact, size.w]);
  const ui = useMemo(() => {
    const pad = 18;
    const gap = 8;
    const full = size.w - 2 * pad;
    return { pad, gap, full, bw: (full - 2 * gap) / 3, searchY: size.h * 0.1, btnY: size.h * 0.215 };
  }, [size]);
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
      ],
      phone: [{ kind: "phone", id: "phone" }],
      categories: categoryCards
    };
  }, [shopCards, busRoutes, categoryCards, t]);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let tallest = 0;
    let lastW = 0;
    const update = () => {
      const header = document.querySelector(".site-header");
      const hdr = header ? header.offsetHeight : HDR_FALLBACK;
      const w = document.documentElement.clientWidth;
      // On touch screens the address bar sliding away (or the keyboard opening) changes the height: never shrink
      // for that, otherwise every section would resize and the page would jump (or stay squashed once the keyboard
      // has been up). Only a width change (rotation) re-lays out from scratch.
      if (w !== lastW) tallest = 0;
      lastW = w;
      // Small growth is just the address bar hiding (ignored); a big one means the keyboard closed.
      if (!tallest || window.innerHeight > tallest + 120) tallest = window.innerHeight;
      const h = (coarse ? tallest : window.innerHeight) - hdr;
      setSize((cur) => (cur.w === w && cur.h === h && cur.hdr === hdr ? cur : { w, h, hdr, compact: w < COMPACT_W }));
    };
    update();
    const onShow = () => { if (!document.hidden) update(); };
    window.addEventListener("resize", update);
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", onShow);
    };
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

  // Story positions (v) of every scene, and where the story ends.
  const beats = useMemo(() => {
    const [, b1, b2, b3, b4, b5] = blocks;
    return {
      list: [0, b1.T + b1.P * 0.5, b2.T + b2.P * 0.5, b3.T + b3.P * 0.5, b4.T + b4.P * 0.5, b5.T + b5.P * 0.66],
      end: b5.T + b5.P + size.h
    };
  }, [blocks, size.h]);

  // Bowl placement: centred along the bottom of the stage, its visible base 20px above the edge.
  const bowl = useMemo(() => {
    const bw = size.compact ? Math.min(size.w * 0.74, size.h * 0.95) : Math.min(size.w * 0.46, 640, size.h * 1.45);
    const bh = (bw * BOWL_H) / BOWL_W;
    return { bw, bh, left: (size.w - bw) / 2, top: size.h - bh * 0.9 - 20 };
  }, [size]);

  // Card size follows the stage. On desktop each chapter's cards sit in a 2x2 block opposite the bowl; on a phone
  // they sit in a 2x2 block between the chapter's text (above) and the bowl (below).
  const mouthStage = bowl.top + (MOUTH_Y / BOWL_H) * bowl.bh;
  const cardBox = useMemo(() => {
    if (size.compact) {
      const availH = mouthStage - 28 - size.h * 0.4;
      const cw = clamp(Math.min((size.w - 3 * 14 - 2 * 18) / 2, (availH - 14) / 2 / 1.22), 96, 150);
      return { cw, ch: cw * 1.22 };
    }
    const cw = clamp(Math.min(size.w * 0.19, (size.h - 170) / 2 / 1.22), 130, 232);
    return { cw, ch: cw * 1.22 };
  }, [size, mouthStage]);
  // The finale's grid: rows of tiles filling the space between the heading and the bowl.
  const catTiles = useMemo(() => {
    const n = (chapterCards.categories || []).length;
    const compact = size.compact;
    const gap = compact ? 8 : 16;
    const cols = compact ? (n <= 12 ? 3 : 4) : Math.min(8, Math.max(1, n));
    const rows = Math.max(1, Math.ceil(n / cols));
    const availW = size.w * (compact ? 0.92 : 0.9);
    const top = size.h * (compact ? 0.21 : 0.22);
    const availH = compact ? mouthStage - 46 - top : size.h * 0.46;
    let tw = Math.min(compact ? 118 : 160, (availW - (cols - 1) * gap) / cols);
    let th = tw * 1.18;
    if (rows * th + (rows - 1) * gap > availH) {
      th = (availH - (rows - 1) * gap) / rows;
      tw = th / 1.18;
    }
    const totalH = rows * th + (rows - 1) * gap;
    const y0 = top + (availH - totalH) / 2 + th / 2;
    const geos = Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const rowW = inRow * tw + (inRow - 1) * gap;
      return { x: (size.w - rowW) / 2 + tw / 2 + (i % cols) * (tw + gap), y: y0 + row * (th + gap) };
    });
    return { tw, th, geos };
  }, [chapterCards.categories, size, mouthStage]);
  const cardGeo = useMemo(() => {
    const gap = size.compact ? 14 : 22;
    return CHAPTERS.map((chapter) => {
      if (chapter.key === "categories") return catTiles.geos;
      const n = (chapterCards[chapter.key] || []).length;
      const cols = n >= 3 ? 2 : Math.max(1, n);
      const rows = n >= 3 ? 2 : 1;
      const compact = size.compact;
      const regionX = compact ? 0 : chapter.side === "left" ? size.w * 0.5 : size.w * 0.04;
      const regionW = compact ? size.w : size.w * 0.46;
      const totalW = cols * cardBox.cw + (cols - 1) * gap;
      const totalH = rows * cardBox.ch + (rows - 1) * gap + (cols > 1 && !compact ? 26 : 0);
      const x0 = regionX + (regionW - totalW) / 2 + cardBox.cw / 2;
      // Desktop centres the block on the stage; a phone centres it between the text and the bowl.
      const y0 = compact
        ? chapter.key === "phone"
          ? (size.h * 0.3 + mouthStage - 40) / 2 - cardBox.ch / 2 + cardBox.ch / 2
          : size.h * 0.4 + (mouthStage - 28 - size.h * 0.4 - totalH) / 2 + cardBox.ch / 2
        : size.h / 2 - totalH / 2 + cardBox.ch / 2 - 8;
      return Array.from({ length: n }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return { x: x0 + col * (cardBox.cw + gap), y: y0 + row * (cardBox.ch + gap) + (col && !compact ? 26 : 0) };
      });
    });
  }, [size, cardBox, chapterCards, catTiles, mouthStage]);

  useEffect(() => {
    const story = storyRef.current;
    if (!story || !size.w) return undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cx = size.w / 2;
    const cy = size.h / 2 - (size.compact ? 4 : 16);
    const rx = size.compact ? size.w * 0.42 : Math.min(size.w * 0.38, 600);
    const ry = size.compact ? Math.min(size.h * 0.37, 300) : Math.min(size.h * 0.35, 320);
    const n = tiles.length;
    const mouthX = bowl.left + bowl.bw / 2;
    const mouthStageY = bowl.top + (MOUTH_Y / BOWL_H) * bowl.bh;
    // Tiles drop in a scrambled order (golden-ratio steps) so neighbours do not all go at once.
    const order = tiles.map((_, i) => (i * 0.6180339887) % 1);
    const tileStep = clamp(size.w * 0.22, 72, 104) + 12;
    const rowLen = [tiles.filter((x) => x.row === 0).length, tiles.filter((x) => x.row === 1).length];
    // Bowl anchors per block: centre for the intro, then the side of each chapter (left, right, left).
    // ...and finally the centre, under the category tiles.
    // On a phone the bowl still alternates sides, but only a little way off centre, and a bit smaller.
    const leftX = size.compact ? size.w * 0.3 : size.w * 0.24;
    const rightX = size.compact ? size.w * 0.7 : size.w * 0.76;
    const sideScale = size.compact ? 0.64 : BOWL_SIDE_SCALE;
    const anchorX = [cx, ...CHAPTERS.map((c) => (c.side === "left" ? leftX : c.side === "center" ? cx : rightX))];
    const anchorS = [1, ...CHAPTERS.map((c) => (c.side === "center" ? 1 : sideScale))];
    const arc = size.h * (size.compact ? 0.12 : 0.22);
    const storyH = blocks[blocks.length - 1].T + blocks[blocks.length - 1].P + size.h;

    const cubic = (a, b, c, d, t) => {
      const u = 1 - t;
      return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
    };
    const inBowl = (x, y, mxL, myL, sc) => Math.abs(x - mxL) < bowl.bw * sc * 0.62 && y > myL - bowl.bh * sc * 1.05;
    // The warp: whatever goes into or comes out of the bowl is drawn into a spiral around its mouth and stretched along
    // the way it travels. `near` is 1 at the mouth and 0 once settled, so the same effect runs in and out.
    const warpXf = (px, py, mx, my, near, sgn, sc, spin) => {
      const swirl = near * near * 1.2 * sgn;
      const dx0 = px - mx;
      const dy0 = py - my;
      const c = Math.cos(swirl);
      const sn = Math.sin(swirl);
      const x = mx + dx0 * c - dy0 * sn;
      const y = my + dx0 * sn + dy0 * c;
      const ang = Math.atan2(y - my, x - mx) * (180 / Math.PI);
      const w = Math.pow(near, 1.4);
      const along = 1 + 1.5 * w;
      const across = Math.max(0.35, 1 - 0.55 * w);
      return `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${ang.toFixed(1)}deg) scale(${(along * sc).toFixed(3)}, ${(across * sc).toFixed(3)}) rotate(${(spin - ang).toFixed(1)}deg)`;
    };

    let raf = 0;
    let lastBeat = -1;
    let lastEnd = null;
    let last = performance.now();
    let marq = 0;
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
      marq += dt * 26;
      pull += ((focusRef.current ? 1 : 0) - pull) * Math.min(1, dt * 4);

      // v is the story coordinate sitting at the header line; every block's stage sticks while v is inside it.
      const rect = story.getBoundingClientRect();
      const v = size.hdr - rect.top;
      const stageTopOf = (b) => clamp(v, blocks[b].T, blocks[b].T + blocks[b].P);
      const stageTop0 = stageTopOf(0);
      // The bowl layer is pinned natively for the whole story, so its own offset is simply how far it has stuck.
      const layerTop = clamp(v, 0, storyH - size.h);
      const p = clamp(v / Math.max(1, blocks[0].P));
      // The intro scene (beam, sparks, headline, chips) hands over to the first chapter.

      // The bowl rises into view as the first tiles start to fall.
      // On a phone the bowl is already waiting at the bottom when the page opens.
      const rise = size.compact ? 0 : 1 - smooth(p, 0.02, 0.16);
      const lift = rise * bowl.bh * 1.15;
      const bowlOpacity = size.compact ? 1 : smooth(p, 0.02, 0.1);

      // Where the bowl is: parked at its block's anchor while that block is pinned, and travelling down to the
      // next block's anchor (swooping through the screen) while the page scrolls one block over.
      let bx = cx;
      let by = stageTop0 + mouthStageY + lift;
      let bs = 1;
      let tilt = 0;
      for (let b = 0; b < blocks.length; b += 1) {
        const end = blocks[b].T + blocks[b].P;
        const last = b === blocks.length - 1;
        if (v <= end || last) {
          // In the finale the bowl, once the categories are out, drops away below the bottom of the screen.
          const goDown = last ? smooth((v - blocks[b].T) / Math.max(1, blocks[b].P), 0.72, 0.95) : 0;
          bx = anchorX[b];
          by = stageTopOf(b) + mouthStageY + (b === 0 ? lift : 0) + goDown * size.h * 0.95;
          bs = anchorS[b] * (1 - 0.18 * goDown);
          tilt = goDown * 10;
          break;
        }
        const nextT = blocks[b + 1].T;
        if (v < nextT) {
          const tr = (v - end) / (nextT - end);
          const e = smooth(tr, 0, 1);
          bx = lerp(anchorX[b], anchorX[b + 1], e);
          by = lerp(end + mouthStageY, nextT + mouthStageY, tr) - arc * Math.sin(Math.PI * tr);
          bs = lerp(anchorS[b], anchorS[b + 1], e);
          tilt = Math.sign(anchorX[b + 1] - anchorX[b]) * 14 * Math.sin(Math.PI * tr);
          break;
        }
      }
      const glowBase = bowlOpacity * (0.4 + 0.6 * smooth(p, 0.1, 0.55));
      const dx = bx - mouthX;
      const dy = by - layerTop - mouthStageY;
      for (const ref of [bowlBackRef, bowlFrontRef]) {
        const el = ref.current;
        if (!el) continue;
        el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${bs.toFixed(3)})`;
        el.style.opacity = bowlOpacity.toFixed(3);
      }
      if (bowlGlowRef.current) {
        bowlGlowRef.current.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
      }
      if (glowRef.current) glowRef.current.style.transform = `translate(-50%, calc(-52% + ${(stageTop0 - layerTop + size.h * 0.5).toFixed(1)}px))`;

      // Intro: tiles ring the search, then fall into the mouth (stage coordinates plus the pinned offset).
      const mouthY = mouthStageY + lift;
      // Whenever something passes through the mouth the bowl flares.
      let flare = 0;
      const open = 1 + 0.06 * smooth(p, 0, 0.1) - 0.05 * pull;
      for (let i = 0; i < n; i += 1) {
        const el = tileRefs.current[i];
        if (!el) continue;
        let ox;
        let oy;
        let os;
        let depthOnRing;
        const tl = tiles[i];
        if (size.compact) {
          // two strips drifting in opposite directions, wrapping around off the edges of the screen
          const step = tileStep;
          const len = rowLen[tl.row] * step;
          const dir = tl.row ? 1 : -1;
          let px = (tl.idx * step + dir * marq) % len;
          if (px < 0) px += len;
          ox = px - step + tileStep / 2;
          oy = size.h * (tl.row ? 0.545 : 0.385);
          os = 1;
          depthOnRing = 0.6;
        } else {
          const a = angle + (i / n) * TAU - Math.PI / 2;
          depthOnRing = (Math.sin(a) + 1) / 2;
          ox = cx + rx * open * Math.cos(a);
          oy = cy + ry * open * Math.sin(a);
          os = 0.88 + 0.12 * depthOnRing;
        }

        // Each tile has its own slot in the scroll: it leaves the ring, falls with gravity, shrinks and tumbles
        // towards the mouth, then sinks behind the front lip.
        const start = size.compact ? 0.04 + 0.4 * order[i] : 0.05 + 0.5 * order[i];
        const f = clamp((p - start) / (size.compact ? 0.3 : 0.33));
        // It lifts over the rim and comes down vertically through the opening (never through the side of the bowl).
        const tp = smooth(f, 0, 1);
        const x = cubic(ox, ox, mouthX, mouthX, tp);
        let y = cubic(oy, Math.min(oy, mouthY) - bowl.bh * 0.55, mouthY - bowl.bh * 1.0, mouthY, tp);
        y += smooth(f, 0.8, 1) * bowl.bh * 0.36;
        flare = Math.max(flare, smooth(f, 0.55, 0.9) * (1 - smooth(f, 0.93, 1)));
        const s = lerp(os, 0.3, Math.pow(f, 0.7));
        const spin = (i % 2 ? 1 : -1) * 30 * f;
        const yy = y + stageTop0 - layerTop;
        el.style.transform = warpXf(x, yy, mouthX, mouthY + stageTop0 - layerTop, f, i % 2 ? 1 : -1, s, spin);
        el.classList.toggle("is-warping", f > 0.02 && f < 0.98);
        el.style.opacity = lerp(0.82 + 0.18 * depthOnRing, 1, clamp(f * 6)).toFixed(3);
        el.style.zIndex = String(Math.round(depthOnRing * 10));
        el.style.pointerEvents = f > 0 ? "none" : "auto";
        el.style.visibility = f >= 1 ? "hidden" : "visible";
      }

      // Phone home: the search field and the three action buttons are drawn into the bowl last (and come out first).
      if (size.compact) {
        const uiGeo = [
          { x: cx, y: ui.searchY, start: 0.66, dur: 0.28 },
          ...[0, 1, 2].map((k) => ({ x: ui.pad + ui.bw / 2 + k * (ui.bw + ui.gap), y: ui.btnY, start: 0.5 + 0.07 * k, dur: 0.26 }))
        ];
        uiGeo.forEach((geo, i) => {
          const el = uiRefs.current[i];
          if (!el) return;
          const f = clamp((p - geo.start) / geo.dur);
          const tp = smooth(f, 0, 1);
          const x = cubic(geo.x, geo.x, mouthX, mouthX, tp);
          let y = cubic(geo.y, Math.min(geo.y, mouthY) - bowl.bh * 0.55, mouthY - bowl.bh * 1.0, mouthY, tp);
          y += smooth(f, 0.8, 1) * bowl.bh * 0.36;
          flare = Math.max(flare, smooth(f, 0.55, 0.9) * (1 - smooth(f, 0.93, 1)));
          const yy = y + stageTop0 - layerTop;
          el.style.transform = warpXf(x, yy, mouthX, mouthY + stageTop0 - layerTop, f, i % 2 ? 1 : -1, lerp(1, 0.3, Math.pow(f, 0.7)), (i % 2 ? 1 : -1) * 20 * f);
          el.classList.toggle("is-warping", f > 0.02 && f < 0.98);
          el.style.pointerEvents = f > 0 ? "none" : "auto";
          el.style.visibility = f >= 1 ? "hidden" : "visible";
        });
      }

      const hero = heroRef.current;
      if (hero) {
        const fade = smooth(p, 0.04, 0.2);
        hero.style.opacity = String(1 - fade);
        hero.style.transform = `translateY(${(-36 * fade).toFixed(1)}px)`;
        hero.style.visibility = fade > 0.98 ? "hidden" : "visible";
      }
      if (hintRef.current) hintRef.current.style.opacity = String(1 - smooth(p, 0, 0.06));

      // Chapters: once the bowl has landed in a block, its cards pop out of the mouth one by one; before the page
      // scrolls on, they drop back in.
      for (let k = 0; k < CHAPTERS.length; k += 1) {
        const b = k + 1;
        const fall = CHAPTERS[k].fall === undefined ? 0.64 : CHAPTERS[k].fall;
        const q = (v - blocks[b].T) / Math.max(1, blocks[b].P);
        if (CHAPTERS[k].key === "phone") {
          // The phone walks through Find, Unlock and Book while the section is pinned.
          const step = q < 0.4 ? 0 : q < 0.58 ? 1 : 2;
          phoneScreenRefs.current.forEach((el, i) => el && el.classList.toggle("is-on", i === step));
          phoneChipRefs.current.forEach((el, i) => el && el.classList.toggle("is-active", i === step));
        }
        const top = stageTopOf(b);
        const geos = cardGeo[k] || [];
        for (let j = 0; j < geos.length; j += 1) {
          const el = cardRefs.current[`${k}-${j}`];
          if (!el) continue;
          const stagger = geos.length > 6 ? 0.025 : 0.06;
          let g = clamp((q - (0.04 + stagger * j)) / 0.22);
          if (fall !== null) g *= 1 - smooth(q, fall + 0.03 * j, fall + 0.22 + 0.03 * j);
          const e = smooth(g, 0, 1);
          const tx = geos[j].x;
          const ty = top + geos[j].y - layerTop;
          // A card leaves the bowl straight up through the mouth (starting hidden below the front lip) and only then
          // curves off to its place; going back it drops vertically into the opening. While it overlaps the bowl it
          // stays behind the front lip, so it really comes out of it rather than passing in front.
          const mxL = bx;
          const myL = by - layerTop;
          const sx = mxL;
          const sy = myL + bowl.bh * 0.3 * bs;
          const c1y = myL - bowl.bh * bs * 1.0;
          const c2x = lerp(mxL, tx, 0.75);
          const c2y = Math.min(ty, myL) - bowl.bh * 0.45;
          const x = cubic(sx, mxL, c2x, tx, e);
          const y = cubic(sy, c1y, c2y, ty, e);
          const rot = (1 - e) * (j % 2 ? 14 : -14);
          el.style.transform = warpXf(x, y, mxL, myL, 1 - e, j % 2 ? -1 : 1, 0.25 + 0.75 * e, rot);
          el.classList.toggle("is-warping", e > 0.02 && e < 0.98);
          flare = Math.max(flare, smooth(1 - e, 0.55, 0.9) * (g > 0.001 ? 1 : 0) * (1 - smooth(1 - e, 0.93, 1)));
          el.style.opacity = g > 0 ? "1" : "0";
          el.style.zIndex = inBowl(x, y, mxL, myL, bs) ? "2" : "6";
          el.style.visibility = g <= 0.001 ? "hidden" : "visible";
          el.style.pointerEvents = g > 0.95 ? "auto" : "none";
        }
      }
      // Progress ring and current scene for the "See more" control.
      const prog = clamp(v / Math.max(1, storyH - size.h));
      if (ringRef.current) ringRef.current.style.strokeDashoffset = (RING * (1 - prog)).toFixed(1);
      let near = 0;
      for (let b = 1; b < beats.list.length; b += 1) if (Math.abs(beats.list[b] - v) < Math.abs(beats.list[near] - v)) near = b;
      if (near !== lastBeat) {
        lastBeat = near;
        setBeat(near);
      }
      const finished = v > beats.list[beats.list.length - 1] - 14;
      if (finished !== lastEnd) {
        lastEnd = finished;
        setAtEnd(finished);
      }
      if (bowlGlowRef.current) {
        bowlGlowRef.current.style.opacity = Math.min(1, glowBase * (1 + 0.8 * flare)).toFixed(3);
        bowlGlowRef.current.style.scale = (bs * (1 + 0.16 * flare)).toFixed(3);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [tiles, bowl, size, blocks, cardGeo, ui, beats]);

  // Manual trigger: an eased, automatic scroll to a scene. Any wheel, touch or key press takes control straight back.
  const cancelGlide = useCallback(() => {
    if (glideRef.current) cancelAnimationFrame(glideRef.current);
    glideRef.current = 0;
  }, []);
  useEffect(() => {
    window.addEventListener("wheel", cancelGlide, { passive: true });
    window.addEventListener("touchstart", cancelGlide, { passive: true });
    window.addEventListener("keydown", cancelGlide);
    window.addEventListener("mousedown", cancelGlide);
    return () => {
      cancelGlide();
      window.removeEventListener("wheel", cancelGlide);
      window.removeEventListener("touchstart", cancelGlide);
      window.removeEventListener("keydown", cancelGlide);
      window.removeEventListener("mousedown", cancelGlide);
    };
  }, [cancelGlide]);
  const currentV = () => size.hdr - storyRef.current.getBoundingClientRect().top;
  const glideToV = (target) => {
    const story = storyRef.current;
    if (!story) return;
    cancelGlide();
    const from = window.scrollY;
    const to = story.getBoundingClientRect().top + window.scrollY + target - size.hdr;
    const dist = to - from;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo({ top: to, behavior: "instant" });
      return;
    }
    const dur = clamp(700 + Math.abs(dist) * 0.8, 1100, 4800);
    const t0 = performance.now();
    const ease = (x) => 0.5 - Math.cos(Math.PI * x) / 2;
    const step = (now) => {
      const k = clamp((now - t0) / dur);
      window.scrollTo({ top: from + dist * ease(k), behavior: "instant" });
      glideRef.current = k < 1 ? requestAnimationFrame(step) : 0;
    };
    glideRef.current = requestAnimationFrame(step);
  };
  const goNext = () => {
    const v = currentV();
    const next = beats.list.find((b) => b > v + 14);
    glideToV(next === undefined ? beats.end : next);
  };

  // The home search finds things near the visitor: submitting opens the nearby map + list.
  const submit = (event) => {
    event.preventDefault();
    if (searchValue.trim().length >= 2) {
      document.activeElement?.blur?.();
      setNearbyOpen(true);
    }
  };

  // Phone-width screens use the mobile home instead, so tile size only has to suit tablets and up.
  const tileW = size.compact ? clamp(size.w * 0.22, 72, 104) : clamp(Math.min(size.w, size.h * 1.5) * 0.075, 56, 92);
  const bowlStyle = { left: bowl.left, top: bowl.top, width: bowl.bw, height: bowl.bh };
  const stageStyle = { top: size.hdr, height: size.h };
  const phoneW = size.compact ? clamp(Math.min(size.w * 0.52, (mouthStage - 40 - size.h * 0.3 - 8) / 2.03), 120, 200) : clamp(Math.min(size.h * 0.42, size.w * 0.2), 190, 290);

  return (
    <section className="story" ref={storyRef} aria-label={t("landing.orbitAria")} style={{ "--tw": `${tileW}px`, "--th": `${tileW * 1.22}px` }}>
      {/* The layer the bowl, the tiles and the cards live in: positioned in page coordinates, so the bowl can
          travel from one section to the next while the page scrolls under it. */}
      <div className="story-layer" style={{ top: size.hdr, height: size.h }}>
        <div className="ho-glow" ref={glowRef} aria-hidden="true" />
        <div
          className="ho-bowl-glow"
          ref={bowlGlowRef}
          aria-hidden="true"
          style={{ left: bowl.left - bowl.bw * 0.15, top: bowl.top - bowl.bh * 0.2, width: bowl.bw * 1.3, height: bowl.bh * 1.2 }}
        />

        <div className="ho-bowl ho-bowl-back" ref={bowlBackRef} style={bowlStyle}><BowlBack /></div>

        <div className="ho-tiles">
          {tiles.map((tl, i) => { const cat = tl.cat; return (
            <Link
              key={tl.key}
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
          ); })}
          {size.compact ? (
            <>
              <form className="ho-search ho-ui ho-ui-search" ref={(el) => { uiRefs.current[0] = el; }} style={{ width: ui.full }} onSubmit={submit}>
                <span className="ho-search-icon"><IconSearch /></span>
                <input type="text" value={searchValue} onChange={(e) => onSearchChange(e.target.value)} placeholder={t("nearby.placeholder")} aria-label={t("nearby.ariaLabel")} />
                <button type="submit" className="ho-search-go" aria-label={t("landing.searchButton")}><IconArrowRight /></button>
              </form>
              {[["/shop", IconCart, "landing.shop"], ["/ride", IconCar, "landing.ride"], ["/bus", IconBus, "landing.bus"]].map(([to, Icon, label], k) => (
                <Link key={to} to={to} className="ho-ui ho-ui-btn" ref={(el) => { uiRefs.current[k + 1] = el; }} style={{ width: ui.bw }}>
                  <Icon /> <span>{t(label)}</span>
                </Link>
              ))}
            </>
          ) : null}
        </div>

        <div className="ho-bowl ho-bowl-front" ref={bowlFrontRef} style={bowlStyle}><BowlFront /></div>

        <div className="ho-cards" style={{ "--cw": `${cardBox.cw}px` }}>
          {CHAPTERS.map((chapter, k) =>
            (chapterCards[chapter.key] || []).map((card, j) =>
              card.kind === "phone" ? (
                <div key={`${chapter.key}-${card.id}`} className="ho-card-pos ho-phone-pos" style={{ width: phoneW }} ref={(el) => { cardRefs.current[`${k}-${j}`] = el; }}>
                  <div className="hp-phone ho-phone" style={{ width: phoneW }} aria-hidden="true">
                    <span className="hp-notch" />
                    <div className="hp-screen is-on" ref={(el) => { phoneScreenRefs.current[0] = el; }}><FindScreen providers={phoneProviders.slice(0, 3)} /></div>
                    <div className="hp-screen" ref={(el) => { phoneScreenRefs.current[1] = el; }}><UnlockScreen provider={phoneProviders[0]} /></div>
                    <div className="hp-screen" ref={(el) => { phoneScreenRefs.current[2] = el; }}><BookScreen /></div>
                  </div>
                </div>
              ) : (
                <div key={`${chapter.key}-${card.id}`} className="ho-card-pos" style={card.kind === "tile" ? { width: catTiles.tw, "--th2": `${catTiles.th}px` } : undefined} ref={(el) => { cardRefs.current[`${k}-${j}`] = el; }}>
                  <Link to={card.to} className={`ho-card ho-card-${card.kind}`} style={{ animationDelay: `${(k + j) * 0.5}s` }}>
                    {renderCard(card, t)}
                  </Link>
                </div>
              )
            )
          )}
        </div>

        <div className="ho-next-wrap">
          <button type="button" className={`ho-next ${atEnd ? "is-last" : ""}`} onClick={goNext} aria-label={atEnd ? t("landing.next.keepGoing") : t("landing.next.more")}>
            <span className="ho-next-label">{atEnd ? t("landing.next.keepGoing") : t("landing.next.more")}</span>
            <span className="ho-next-orb">
              <svg viewBox="0 0 56 56" aria-hidden="true">
                <circle cx="28" cy="28" r="25" className="ho-next-track" />
                <circle cx="28" cy="28" r="25" className="ho-next-bar" ref={ringRef} strokeDasharray={RING} strokeDashoffset={RING} />
              </svg>
              <span className="ho-next-core"><IconChevronLeft /></span>
            </span>
          </button>
        </div>

        <nav className="ho-dots" aria-label={t("landing.next.sections")}>
          {BEAT_NAMES.map((name, i) => (
            <button key={name} type="button" className={i === beat ? "is-active" : ""} data-label={t(`landing.beats.${name}`)} onClick={() => glideToV(beats.list[i])} aria-label={t(`landing.beats.${name}`)} />
          ))}
        </nav>
      </div>
      <div className="story-blocks">
      {/* Block 0: the orbit, the fall into the bowl and the lit-up scene. */}
      <div className="hb hb-intro" style={{ height: blocks[0].P + size.h }}>
        <div className="hb-stage ho-sticky" style={stageStyle}>
          {size.compact ? <div className="ho-lang"><LanguageSwitcher /></div> : null}
          {size.compact ? null : (
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
                placeholder={t("nearby.placeholder")}
                aria-label={t("nearby.ariaLabel")}
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
          )}

          <div className="ho-hint" ref={hintRef} aria-hidden="true">
            <span>{t("landing.scrollHint")}</span>
            <i />
          </div>
        </div>
      </div>

      {/* Blocks 1-4: one section per chapter, each sliding in from below as the page scrolls. */}
      {CHAPTERS.map((chapter, k) => (
        <div key={chapter.key} id={chapter.key === "categories" ? "categories" : undefined} className={`hb hb-${chapter.key}`} style={{ height: blocks[k + 1].P + size.h }}>
          <div className="hb-stage" style={stageStyle}>
            {chapter.key === "categories" ? (
              <div className="ho-park is-in">
                <h2 className="home-section-title">{t("home.categories.title")}</h2>
                <p className="home-section-subtitle">{t("home.categories.subtitle")}</p>
              </div>
            ) : chapter.key === "phone" ? (
              <div className={`ho-side ho-side-${chapter.side}`}>
                <h2>{t("landing.phone.title")}</h2>
                <div className="hp-chips" aria-hidden="true">
                  {PHONE_STEPS.map((key, i) => (
                    <button key={key} type="button" tabIndex={-1} className={i === 0 ? "is-active" : ""} ref={(el) => { phoneChipRefs.current[i] = el; }}>
                      <b>{i + 1}</b> {t(`landing.phone.${key}`)}
                    </button>
                  ))}
                </div>
                <p>{t("landing.phone.body")}</p>
                <Link to={chapter.to} className="ho-side-cta">{t("landing.phone.cta")} <IconArrowRight /></Link>
              </div>
            ) : (
              <div className={`ho-side ho-side-${chapter.side}`}>
                <span className="home-eyebrow">{t(chapter.eyebrow)}</span>
                <h2>{t(chapter.title)}</h2>
                <p>{t(chapter.sub)}</p>
                <Link to={chapter.to} className="ho-side-cta">{t(chapter.cta)} <IconArrowRight /></Link>
              </div>
            )}
          </div>
        </div>
      ))}

      </div>
      {nearbyOpen ? <NearbyOverlay text={searchValue} onTextChange={onSearchChange} onClose={() => setNearbyOpen(false)} /> : null}
    </section>
  );
}
