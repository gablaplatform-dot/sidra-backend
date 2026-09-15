import React from "react";
import { ANNOUNCEMENTS } from "../../data/shopData";

const IconTruck = (props) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
  </svg>
);

const IconFire = (props) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-3 2-3 6a6 6 0 0 0 12 0c0-6-6-11-6-11z" />
  </svg>
);

const IconBolt = (props) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const iconMap = { truck: IconTruck, fire: IconFire, bolt: IconBolt };

export default function ShopTopBar() {
  return (
    <div className="shop-topbar">
      <div className="shop-topbar-inner">
        {ANNOUNCEMENTS.map((item, idx) => {
          const Icon = iconMap[item.icon];
          return (
            <div className="shop-topbar-item" key={idx}>
              {Icon ? <Icon /> : null}
              <span>{item.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
