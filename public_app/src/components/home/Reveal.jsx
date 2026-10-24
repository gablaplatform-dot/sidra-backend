import React, { useEffect, useRef } from "react";

// One observer shared by every Reveal: elements fade and rise into place the first time they scroll into view.
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

// `from` picks the direction it travels in from: up (default), left, right or zoom. `delay` staggers siblings (ms).
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
