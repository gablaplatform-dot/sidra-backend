import React from "react";
import { useNavigate } from "react-router-dom";

import { IconChevronLeft } from "./icons";

// Goes back one step in the app. When the page was opened directly (nothing to go back to inside Gabla) it
// goes to `fallback` instead, so the button never leaves the site or does nothing.
export default function BackButton({ fallback = "/home", className = "" }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate(fallback);
  };
  return (
    <button type="button" className={`back-btn ${className}`} onClick={goBack} aria-label="Go back">
      <IconChevronLeft width={22} height={22} />
    </button>
  );
}
