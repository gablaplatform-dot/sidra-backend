import { useEffect } from "react";

// New page => start at the top (the router keeps the previous scroll position otherwise).
export default function useScrollTop(key = "") {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);
}
