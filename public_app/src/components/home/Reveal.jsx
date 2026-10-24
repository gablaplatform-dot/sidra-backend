import React, { useEffect, useRef } from "react";

// Everything fades and rises into place the first time it scrolls into view.
let observer;
const getObserver = () => {
  if (!observer && typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
  }
  return observer;
};

// `from` picks the direction it travels in from: up (default), left, right or zoom.
// `delay` staggers siblings (ms).
export default function Reveal({ as: Tag = "div", from = "up", delay = 0, className = "", style, children, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
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
