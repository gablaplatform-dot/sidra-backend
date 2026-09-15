import React from "react";
import { TRUST_BADGES } from "../../data/shopData";
import { IconShield } from "../icons";

const IconTruck = (props) => (
  <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
  </svg>
);

const IconRefresh = (props) => (
  <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.5 9A9 9 0 0 1 20.5 7M20.5 15A9 9 0 0 1 3.5 17" />
  </svg>
);

const IconHeadset = (props) => (
  <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
    <rect x="2" y="14" width="5" height="7" rx="1.5" />
    <rect x="17" y="14" width="5" height="7" rx="1.5" />
  </svg>
);

const iconMap = { truck: IconTruck, shield: IconShield, refresh: IconRefresh, headset: IconHeadset };

export default function ShopTrustBar() {
  return (
    <section className="shop-trustbar">
      <div className="shop-trustbar-inner">
        {TRUST_BADGES.map((badge, idx) => {
          const Icon = iconMap[badge.icon];
          return (
            <div className="shop-trust-item" key={idx}>
              <div className="shop-trust-icon">{Icon ? <Icon /> : null}</div>
              <div className="shop-trust-copy">
                <strong>{badge.title}</strong>
                <span>{badge.subtitle}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
