import React from "react";
import { FOOTER_TRUST } from "../../data/shopData";

const IconTruck = (props) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
  </svg>
);

const IconShield = (props) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2.5 20 6v6c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5V6l8-3.5Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const IconLock = (props) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const IconSmile = (props) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

const iconMap = { shield: IconShield, truck: IconTruck, lock: IconLock, smile: IconSmile };

export default function ShopFooterTrust() {
  return (
    <section className="shop-footer-trust">
      <div className="shop-footer-trust-inner">
        {FOOTER_TRUST.map((item, idx) => {
          const Icon = iconMap[item.icon];
          return (
            <div className="shop-footer-trust-item" key={idx}>
              <div className="shop-footer-trust-icon">{Icon ? <Icon /> : null}</div>
              <div className="shop-footer-trust-copy">
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
