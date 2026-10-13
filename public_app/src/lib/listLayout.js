import { useCallback, useState } from "react";

// How product lists are laid out: "grid" (cards, two across on phones) or "list" (compact rows that fit
// more products on screen). The choice is remembered on this device.
const KEY = "gabla_list_layout";

const read = () => {
  try {
    return localStorage.getItem(KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
};

export const useListLayout = () => {
  const [layout, setLayoutState] = useState(read);
  const setLayout = useCallback((next) => {
    setLayoutState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage unavailable: the choice just won't outlive this tab.
    }
  }, []);
  return [layout, setLayout];
};
