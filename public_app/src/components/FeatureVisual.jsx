import React from "react";
import { IconBriefcase, IconCalendar, IconStore } from "./icons";
import "./featureVisual.css";

// Decorative interface icons; actual listing and event media stay separate.
export default function FeatureVisual({ kind = "jobs", className = "" }) {
  const Symbol = kind === "events" ? IconCalendar : kind === "business" ? IconStore : IconBriefcase;
  return (
    <span className={`feature-visual feature-visual--${kind} ${className}`} aria-hidden="true">
      <span className="feature-visual-symbol"><Symbol /></span>
    </span>
  );
}
