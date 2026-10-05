import React, { useEffect, useRef, useState } from "react";

// An <img> that shimmers until the photo has actually arrived, then fades in - so a slow image
// never leaves a blank grey box. Failed loads settle quietly (no endless shimmer).
// Rendered inside a wrapper that fills its parent, so existing `.parent img { ... }` rules still apply.
export default function LazyImg({ src, alt = "", className = "", wrapClassName = "", ...rest }) {
  const ref = useRef(null);
  const [state, setState] = useState("loading"); // loading | loaded | failed

  useEffect(() => {
    setState("loading");
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) setState("loaded"); // already cached
  }, [src]);

  return (
    <span className={`lazy-img is-${state} ${wrapClassName}`}>
      <img
        ref={ref}
        src={src}
        alt={alt}
        className={className}
        onLoad={() => setState("loaded")}
        onError={() => setState("failed")}
        {...rest}
      />
    </span>
  );
}
