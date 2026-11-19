import { useEffect, useRef } from "react";

// Refresh visible order pages and refresh immediately when the buyer returns.
export default function useOrderUpdates(refresh, enabled = true) {
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    if (!enabled) return undefined;
    let busy = false;
    let disposed = false;
    const update = async () => {
      if (disposed || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        await callback.current(() => !disposed);
      } catch {
        // Each order screen retains its own error and retry controls.
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [enabled]);
}
