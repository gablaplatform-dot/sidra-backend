import React from "react";

// Line icons for the bus-company portal. One stroke weight, 24px grid, currentColor.
const make = (children, extra = {}) => {
  const Icon = ({ size = 20, strokeWidth = 1.9, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...extra} {...props}>
      {children}
    </svg>
  );
  return Icon;
};

export const IcHome = make(<><rect x="3.5" y="3.5" width="7" height="8" rx="2" /><rect x="13.5" y="3.5" width="7" height="5" rx="2" /><rect x="13.5" y="11.5" width="7" height="9" rx="2" /><rect x="3.5" y="14.5" width="7" height="6" rx="2" /></>);
export const IcTrips = make(<><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M8 14.5h3M13.5 14.5H16M8 17.5h3" /></>);
export const IcScan = make(<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M7.5 12h9" /></>);
export const IcReceipt = make(<><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-2.5-1.7L14 21l-2-1.7L10 21l-2.5-1.7L5 21V4.5a1 1 0 0 1 1-1Z" /><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" /></>);
export const IcRoute = make(<><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="6" r="2.4" /><path d="M8.4 18H14a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h5.6" /></>);
export const IcClock = make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const IcUsers = make(<><circle cx="9" cy="8.5" r="3.5" /><path d="M2.8 20c0-3.4 2.8-5.7 6.2-5.7s6.2 2.3 6.2 5.7" /><path d="M16.2 5.3a3.4 3.4 0 0 1 0 6.4M18.6 14.8c1.8.8 2.9 2.5 2.9 5.2" /></>);
export const IcMegaphone = make(<><path d="M4 10v4a1 1 0 0 0 1 1h2l8 4.5V4.5L7 9H5a1 1 0 0 0-1 1Z" /><path d="M18.5 9.5a3.5 3.5 0 0 1 0 5M7 15l1.2 4.2a1 1 0 0 0 1 .8h1.1a.7.7 0 0 0 .7-.9L10.2 16" /></>);
export const IcWallet = make(<><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a1 1 0 0 1 1 1v2" /><path d="M4 7.5V17a2.5 2.5 0 0 0 2.5 2.5H19a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 5.5" /><circle cx="16.2" cy="13.5" r="1.1" fill="currentColor" stroke="none" /></>);
export const IcBuilding = make(<><path d="M4 20.5V8.5l8-4 8 4v12" /><path d="M2.5 20.5h19M9 20.5v-5h6v5M8.5 10.5h1M14.5 10.5h1" /></>);
export const IcBus = make(<><rect x="4" y="3.5" width="16" height="14" rx="3.2" /><path d="M4 11h16M4 7.5h16" /><circle cx="8" cy="14.3" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="14.3" r="1" fill="currentColor" stroke="none" /><path d="M6.5 17.5V20M17.5 17.5V20" /></>);
export const IcTicket = make(<><path d="M3 8.5a2 2 0 0 0 0 3.5v0a2 2 0 0 1 0 3.5v1.2a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-1.2a2 2 0 0 1 0-3.5v0a2 2 0 0 0 0-3.5V7.3a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1Z" /><path d="M14.5 6.5v11" strokeDasharray="1.8 2.4" /></>);
export const IcSeat = make(<><path d="M7 4.5h6.2a2.3 2.3 0 0 1 2.3 2.3l.6 7.2H6.4Z" /><path d="M5 14h13.2a1 1 0 0 1 1 1.1l-.3 3.4H6.2a1.7 1.7 0 0 1-1.7-1.8Z" /><path d="M7 18.5V21M17.5 18.5V21" /></>);

export const IcPlus = make(<path d="M12 5v14M5 12h14" />);
export const IcMinus = make(<path d="M5 12h14" />);
export const IcCheck = make(<polyline points="4.5 12.5 9.5 17.5 19.5 7" />);
export const IcClose = make(<path d="M6 6l12 12M18 6L6 18" />);
export const IcChevronRight = make(<polyline points="9 6 15 12 9 18" />);
export const IcChevronLeft = make(<polyline points="15 6 9 12 15 18" />);
export const IcChevronDown = make(<polyline points="6 9 12 15 18 9" />);
export const IcArrowRight = make(<><path d="M5 12h14" /><polyline points="13 6 19 12 13 18" /></>);
export const IcArrowLeft = make(<><path d="M19 12H5" /><polyline points="11 6 5 12 11 18" /></>);
export const IcArrowUp = make(<><path d="M12 19V5" /><polyline points="6 11 12 5 18 11" /></>);
export const IcArrowDown = make(<><path d="M12 5v14" /><polyline points="6 13 12 19 18 13" /></>);
export const IcSearch = make(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>);
export const IcPhone = make(<path d="M5.5 4h3l1.6 4-2 1.3a11 11 0 0 0 5.6 5.6l1.3-2 4 1.6v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 3.5 6.2 2 2 0 0 1 5.5 4Z" />);
export const IcMail = make(<><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="M4 7.5l8 6 8-6" /></>);
export const IcWhatsapp = make(<><path d="M4 20l1.2-4.1A8 8 0 1 1 8.2 19Z" /><path d="M9.2 8.8c.2 2.7 3 5.3 5.6 5.6l1.2-1.3-1.9-1.1-.9.6a4 4 0 0 1-1.9-1.9l.6-.9-1.1-1.9Z" /></>);
export const IcPrint = make(<><path d="M7 9V4h10v5" /><rect x="3.5" y="9" width="17" height="8" rx="2.5" /><path d="M7 14h10v6H7z" /></>);
export const IcExternal = make(<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></>);
export const IcLogout = make(<><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" /><polyline points="16 8 20 12 16 16" /><path d="M20 12H9" /></>);
export const IcEdit = make(<><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M14.5 7.5l3 3" /></>);
export const IcTrash = make(<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 19l1-12M9 7V4.5h6V7" /></>);
export const IcPause = make(<path d="M8.5 5v14M15.5 5v14" />);
export const IcPlay = make(<polygon points="8 4.5 19 12 8 19.5" fill="currentColor" />);
export const IcAlert = make(<><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.4v.01" /></>);
export const IcInfo = make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.01" /></>);
export const IcPin = make(<><path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>);
export const IcDots = make(<><circle cx="5.5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="18.5" cy="12" r="1.2" fill="currentColor" /></>);
export const IcMenu = make(<path d="M4 7h16M4 12h16M4 17h16" />);
export const IcCamera = make(<><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" /><circle cx="12" cy="13" r="3.3" /></>);
export const IcGlobe = make(<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.4 3.5 5.3 3.5 8.5s-1 6.1-3.5 8.5c-2.5-2.4-3.5-5.3-3.5-8.5s1-6.1 3.5-8.5Z" /></>);
export const IcSpark = make(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />);
export const IcCalendarDay = make(<><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /><circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" /></>);
export const IcStar = make(<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.8 6.7 19.6l1.1-5.8L3.5 9.7l5.9-.8Z" />);
export const IcShield = make(<><path d="M12 3.5l7 2.6v5.4c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6.1Z" /><polyline points="8.8 12 11 14.2 15.4 9.6" /></>);
export const IcUpload = make(<><path d="M12 16V5M7.5 9.5L12 5l4.5 4.5" /><path d="M4.5 16v2.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V16" /></>);
export const IcGauge = make(<><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l3.5-5" /><circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" /></>);

export const IcGoogle = ({ size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...props}>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);
