import React from "react";

import { IcBus, IcCheck, IcScan } from "./icons";

// The navy brand side of the sign-in and onboarding screens: logo, a message, and a small
// illustration (a route with a moving bus and a digital ticket).

export const Logo = ({ light = true }) => (
  <span className={`bop-logo ${light ? "is-light" : ""}`}>
    <span className="bop-logo-mark"><IcBus size={22} strokeWidth={2.1} /></span>
    <span className="bop-logo-text"><strong>Gabla Bus</strong><small>For bus companies</small></span>
  </span>
);

export function ArtScene() {
  return (
    <div className="bop-art-scene" aria-hidden="true">
      <svg className="bop-art-route" viewBox="0 0 420 200" fill="none">
        <path d="M30 170 C 110 170, 120 70, 210 78 S 330 40, 392 36" stroke="rgba(255,255,255,0.18)" strokeWidth="3" strokeLinecap="round" />
        <path className="bop-art-dash" d="M30 170 C 110 170, 120 70, 210 78 S 330 40, 392 36" stroke="#ff9a55" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 11" />
        <circle cx="30" cy="170" r="9" fill="#fff" /><circle cx="30" cy="170" r="4" fill="#0c1f46" />
        <circle cx="392" cy="36" r="9" fill="#f26a1b" /><circle cx="392" cy="36" r="16" fill="#f26a1b" opacity="0.25" />
        <text x="30" y="198" fill="#9fb1d8" fontSize="12" fontWeight="700" textAnchor="start">KAMPALA</text>
        <text x="392" y="22" fill="#9fb1d8" fontSize="12" fontWeight="700" textAnchor="end">MBARARA</text>
      </svg>
      <div className="bop-art-row">
      <div className="bop-art-chip"><span><IcScan size={16} /></span><div><strong>87 tickets sold today</strong><small>+61% vs yesterday</small></div></div>
      <div className="bop-art-ticket">
        <div className="bop-art-ticket-head"><span><IcCheck size={13} strokeWidth={3.2} /> VALID</span><small>Seat 14</small></div>
        <div className="bop-art-ticket-route"><div><small>From</small><strong>Kampala</strong></div><i /><div><small>To</small><strong>Mbarara</strong></div></div>
        <div className="bop-art-perf"><i /><span /><i /></div>
        <div className="bop-art-bars">{[3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2].map((w, i) => <b key={i} style={{ width: w * 2 }} />)}</div>
      </div>
      </div>
    </div>
  );
}

export default function BrandPanel({ children, className = "" }) {
  return (
    <aside className={`bop-art ${className}`}>
      <div className="bop-art-top"><Logo /></div>
      <div className="bop-art-mid">{children}</div>
      <ArtScene />
    </aside>
  );
}
