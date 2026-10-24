import React, { useEffect, useRef } from "react";

// One observer shared by every Reveal: elements fade and rise into place the first time they scroll into view.
let observer;

// Items that "come out of Gabla" start at the bowl (as far as it is from them, capped so a card never has to cross
// the whole page) and travel to their place when they scroll into view.
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
  el.style.setProperty("--br", `${(dx >= 0 ? 8 : -8)}deg`);
  void el.offsetWidth;
  el.style.transition = "";
};
const clampNum = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const getObserver = () => {
  if (!observer && typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          if (el.classList.contains("rv-bowl")) launchFromBowl(el);
          el.classList.add("is-in");
          // After the fly-out, hand the normal (hover) transitions back.
          if (el.classList.contains("rv-bowl")) window.setTimeout(() => el.classList.add("rv-done"), 1800 + (parseInt(el.style.getPropertyValue("--rv-delay"), 10) || 0));
          observer.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
  }
  return observer;
};

// `from` picks the direction it travels in from: up (default), left, right, zoom or bowl (out of the Gabla bowl). `delay` staggers siblings (ms).
export default function Reveal({ as: Tag = "div", from = "up", delay = 0, className = "", style, children, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    const io = getObserver();
    if (!node) return undefined;
    if (!io) {
      node.classList.add("is-in");
      return undefined;
    }
    io.observe(node);
    return () => io.unobserve(node);
  }, []);
  return (
    <Tag ref={ref} className={`rv rv-${from} ${className}`.trim()} style={{ ...style, "--rv-delay": `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}
