import React, { useEffect, useRef } from "react";

const clampNum = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Items that "come out of Gabla" start at the bowl's mouth (as far as it is from them, capped so a card never has to
// cross the whole page) and travel to their place.
const launchFromBowl = (el) => {
  const bowl = document.querySelector(".ho-bowl-front");
  if (!bowl) return;
  const b = bowl.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const dx = clampNum(b.left + b.width / 2 - (r.left + r.width / 2), -520, 520);
  const dy = clampNum(b.top + b.height * 0.35 - (r.top + r.height / 2), -640, 640);
  // Set the start position without animating it, then let the class change animate it away.
  el.style.transition = "none";
  el.style.setProperty("--bx", `${dx.toFixed(0)}px`);
  el.style.setProperty("--by", `${dy.toFixed(0)}px`);
  el.style.setProperty("--br", `${dx >= 0 ? 8 : -8}deg`);
  void el.offsetWidth;
  el.style.transition = "";
};

const show = (el) => {
  if (el.classList.contains("rv-bowl")) {
    launchFromBowl(el);
    // After the fly-out, hand the normal (hover) transitions back.
    window.setTimeout(() => el.classList.add("rv-done"), 1800 + (parseInt(el.style.getPropertyValue("--rv-delay"), 10) || 0));
  }
  el.classList.add("is-in");
};

// Everything fades and rises into place the first time it scrolls into view...
let observer;
const getObserver = () => {
  if (!observer && typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          show(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
  }
  return observer;
};

// ...except items that sit ABOVE the bowl (the category cards): those come out of it, so they wait until they scroll
// up past its mouth. One scroll listener serves all of them.
const above = new Set();
let listening = false;
const checkAbove = () => {
  const bowl = document.querySelector(".ho-bowl-front");
  if (!bowl) return;
  const b = bowl.getBoundingClientRect();
  const mouthY = b.top + b.height * 0.35;
  above.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.height) return;
    if (r.top + r.height / 2 < mouthY) {
      show(el);
      above.delete(el);
    }
  });
  if (!above.size && listening) {
    window.removeEventListener("scroll", checkAbove);
    window.removeEventListener("resize", checkAbove);
    listening = false;
  }
};
const watchAbove = (el) => {
  above.add(el);
  if (!listening) {
    window.addEventListener("scroll", checkAbove, { passive: true });
    window.addEventListener("resize", checkAbove);
    listening = true;
  }
  checkAbove();
};

// `from` picks the direction it travels in from: up (default), left, right, zoom or bowl (out of the Gabla bowl).
// `delay` staggers siblings (ms).
export default function Reveal({ as: Tag = "div", from = "up", delay = 0, className = "", style, children, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (from === "bowl") {
      // Items above the story's end (the bowl rests there) emerge from its mouth; items below simply arrive from it.
      const story = document.querySelector(".story");
      const storyBottom = story ? story.getBoundingClientRect().bottom + window.scrollY : 0;
      const r = node.getBoundingClientRect();
      if (r.top + window.scrollY + r.height / 2 < storyBottom) {
        watchAbove(node);
        return () => above.delete(node);
      }
    }
    const io = getObserver();
    if (!io) {
      node.classList.add("is-in");
      return undefined;
    }
    io.observe(node);
    return () => io.unobserve(node);
  }, [from]);
  return (
    <Tag ref={ref} className={`rv rv-${from} ${className}`.trim()} style={{ ...style, "--rv-delay": `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}
