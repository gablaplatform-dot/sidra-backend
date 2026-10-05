import React from "react";

// Small stroke icon set for the bus screens (24px grid, currentColor). Kept local so the shared
// icon file isn't touched.
const I = ({ size = 20, children, fill = "none", strokeWidth = 1.8, ...rest }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
    {children}
  </svg>
);

export const ArrowRight = (p) => <I {...p}><path d="M5 12h14M13 6l6 6-6 6" /></I>;
export const ChevronDown = (p) => <I {...p}><path d="m6 9 6 6 6-6" /></I>;
export const ChevronLeft = (p) => <I {...p}><path d="m15 18-6-6 6-6" /></I>;
export const ChevronRight = (p) => <I {...p}><path d="m9 18 6-6-6-6" /></I>;
export const Swap = (p) => <I {...p}><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></I>;
export const Calendar = (p) => <I {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></I>;
export const CalendarPlus = (p) => <I {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17M12 13v5M9.5 15.5h5" /></I>;
export const Clock = (p) => <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></I>;
export const Pin = (p) => <I {...p}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.4" /></I>;
export const Share = (p) => <I {...p}><path d="M12 15V3.5M8 7l4-4 4 4M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" /></I>;
export const Printer = (p) => <I {...p}><path d="M7 9V3.5h10V9M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><rect x="7" y="14" width="10" height="7" rx="1.5" /></I>;
export const Download = (p) => <I {...p}><path d="M12 3.5v11M8 11l4 4 4-4M5 19.5h14" /></I>;
export const Phone = (p) => <I {...p}><path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 5.9 5.9l1.3-2 4 1.6V18a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 3 6.2 2 2 0 0 1 5 4Z" /></I>;
export const Chat = (p) => <I {...p}><path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.4A7.5 7.5 0 1 1 20 11.5Z" /><path d="M9.2 9.2c.3 2.4 2.2 4.3 4.6 4.6l1-1.3-1.7-.9-.7.6a3 3 0 0 1-1.6-1.6l.6-.7-.9-1.7-1.3 1Z" fill="currentColor" stroke="none" /></I>;
export const Wifi = (p) => <I {...p}><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0" /><circle cx="12" cy="19" r="1" fill="currentColor" /></I>;
export const Snow = (p) => <I {...p}><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5 12 6.5l2.5-2M9.5 19.5 12 17.5l2.5 2" /></I>;
export const Plug = (p) => <I {...p}><path d="M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0V8ZM12 17v4" /></I>;
export const Luggage = (p) => <I {...p}><rect x="6" y="7" width="12" height="13" rx="2.5" /><path d="M9.5 7V4.5h5V7M10 11v5M14 11v5" /></I>;
export const Cup = (p) => <I {...p}><path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V8ZM17 10h1.5a2 2 0 0 1 0 4H17M8 3.5v2M12 3.5v2" /></I>;
export const Seat = (p) => <I {...p}><path d="M7 4h4a2 2 0 0 1 2 2l.5 7H18a2 2 0 0 1 2 2v2.5H9.5A3.5 3.5 0 0 1 6 14V5a1 1 0 0 1 1-1ZM8 21v-2.5M18 21v-2.5" /></I>;
export const Toilet = (p) => <I {...p}><circle cx="12" cy="5" r="1.8" /><path d="M9 21v-7H7l2-6h6l2 6h-2v7M12 8v13" /></I>;
export const Star = ({ size = 16, ...p }) => <I size={size} fill="currentColor" strokeWidth={1} {...p}><path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1L3.2 9.6l6.1-.8L12 3.2Z" /></I>;
export const Check = (p) => <I {...p} strokeWidth={2.4}><path d="m5 12.5 4.5 4.5L19 7.5" /></I>;
export const Sliders = (p) => <I {...p}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></I>;
export const Close = (p) => <I {...p} strokeWidth={2.2}><path d="M6 6l12 12M18 6 6 18" /></I>;
export const Refund = (p) => <I {...p}><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5M12 8v4.5l2.5 1.5" /></I>;
export const Shield = (p) => <I {...p}><path d="M12 3 5 6v5.5c0 4.4 2.9 8 7 9.5 4.1-1.5 7-5.1 7-9.5V6l-7-3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></I>;
export const Qr = (p) => <I {...p}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2.5v2.5H14zM19 14v1M14 19h2M18.5 18.5h1.5V20" /></I>;
export const Wallet = (p) => <I {...p}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2.5 2.5 0 0 0 2.5 2.5H19a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5Z" /><circle cx="15.5" cy="13.5" r="1.1" fill="currentColor" /></I>;
export const Ticket = (p) => <I {...p}><path d="M3.5 8.5a2 2 0 0 0 0 7V18a1.5 1.5 0 0 0 1.5 1.5h14A1.5 1.5 0 0 0 20.5 18v-2.5a2 2 0 0 0 0-7V6A1.5 1.5 0 0 0 19 4.5H5A1.5 1.5 0 0 0 3.5 6v2.5Z" /><path d="M14.5 5v14" strokeDasharray="1.5 3" /></I>;
export const User = (p) => <I {...p}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></I>;
export const Users = (p) => <I {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0M16 5.6a3.2 3.2 0 0 1 0 5.8M18 14.2a6 6 0 0 1 3.2 5.3" /></I>;
export const Sun = (p) => <I {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" /></I>;
export const Sunset = (p) => <I {...p}><path d="M5 17a7 7 0 0 1 14 0M12 5v3M4.5 10l1.8 1.5M19.5 10l-1.8 1.5M2.5 20.5h19" /></I>;
export const Moon = (p) => <I {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></I>;
export const Sunrise = (p) => <I {...p}><path d="M5 17a7 7 0 0 1 14 0M12 3v4M9.5 5.5 12 3l2.5 2.5M2.5 20.5h19" /></I>;
export const Copy = (p) => <I {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" /></I>;
export const BusIcon = (p) => <I {...p}><rect x="4" y="3.5" width="16" height="14.5" rx="3.2" /><path d="M4 11.5h16M8 21v-3M16 21v-3" /><circle cx="8" cy="14.7" r=".9" fill="currentColor" /><circle cx="16" cy="14.7" r=".9" fill="currentColor" /></I>;
export const Search = (p) => <I {...p} strokeWidth={2}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></I>;
export const Menu = (p) => <I {...p}><path d="M4 7h16M4 12h16M4 17h16" /></I>;
export const Home = (p) => <I {...p}><path d="M4 11 12 4l8 7v8a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19v-8Z" /></I>;
export const Building = (p) => <I {...p}><path d="M4 20.5h16M6 20.5V8l6-3.5 6 3.5v12.5M10 20.5v-4h4v4M9.5 10.5h1M13.5 10.5h1M9.5 13.5h1M13.5 13.5h1" /></I>;

// A bus-amenity label -> the best matching icon (falls back to a tick).
export const amenityIcon = (name) => {
  const n = String(name || "").toLowerCase();
  if (/air|a\/c|\bac\b|cool/.test(n)) return Snow;
  if (/wi-?fi|internet/.test(n)) return Wifi;
  if (/charg|usb|power|socket/.test(n)) return Plug;
  if (/luggage|bag|boot|cargo/.test(n)) return Luggage;
  if (/snack|food|meal|drink|water|refresh/.test(n)) return Cup;
  if (/recline|legroom|seat|sleeper/.test(n)) return Seat;
  if (/toilet|restroom|wc/.test(n)) return Toilet;
  return Check;
};
