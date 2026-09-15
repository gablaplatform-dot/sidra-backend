import React from "react";

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

export const IconSearch = (props) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const IconBookmark = (props) => (
  <svg {...base} {...props}>
    <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" />
  </svg>
);

export const IconMenu = (props) => (
  <svg {...base} {...props}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export const IconClose = (props) => (
  <svg {...base} {...props}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

export const IconStar = (props) => (
  <svg {...base} {...props}>
    <polygon points="12 2.5 15.1 8.8 22 9.8 17 14.6 18.2 21.5 12 18.2 5.8 21.5 7 14.6 2 9.8 8.9 8.8" />
  </svg>
);

export const IconChat = (props) => (
  <svg {...base} {...props}>
    <path d="M21 12a8 8 0 1 1-3.2-6.4" />
    <path d="M21 12c0 4.4-3.6 8-8 8-1.1 0-2.2-.2-3.1-.7L4 20l1.3-4.3A7.9 7.9 0 0 1 4 12a8 8 0 0 1 8-8" />
  </svg>
);

export const IconShield = (props) => (
  <svg {...base} {...props}>
    <path d="M12 2.5 20 6v6c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5V6l8-3.5Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const IconPin = (props) => (
  <svg {...base} {...props}>
    <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.4" />
  </svg>
);

export const IconClockIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);

export const IconWrench = (props) => (
  <svg {...base} {...props}>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2Z" />
  </svg>
);

export const IconStore = (props) => (
  <svg {...base} {...props}>
    <path d="M4 10 5 4h14l1 6" />
    <path d="M4 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
    <path d="M5 10v9h14v-9" />
    <path d="M9.5 19v-5h5v5" />
  </svg>
);

export const IconLock = (props) => (
  <svg {...base} {...props}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const IconBox = (props) => (
  <svg {...base} {...props}>
    <path d="M21 8 12 3 3 8l9 5 9-5Z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M12 13v8" />
  </svg>
);

export const IconImage = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="m4 17 5-5 4 4 3-3 4 4" />
  </svg>
);

export const IconPhone = (props) => (
  <svg {...base} {...props}>
    <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />
  </svg>
);

export const IconGlobe = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);

export const IconChevronLeft = (props) => (
  <svg {...base} {...props}>
    <polyline points="15 6 9 12 15 18" />
  </svg>
);

export const IconCamera = (props) => (
  <svg {...base} {...props}>
    <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="14" r="3.3" />
  </svg>
);

export const IconWallet = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18" />
    <circle cx="16" cy="14.5" r="1.4" />
  </svg>
);

export const IconReceipt = (props) => (
  <svg {...base} {...props}>
    <path d="M6 2.5h12v19l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3v-19Z" />
    <path d="M8.5 7h7M8.5 11h7M8.5 15h4" />
  </svg>
);

export const IconCart = (props) => (
  <svg {...base} {...props}>
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2.5 3h2.6l2.3 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21.5 7H6" />
  </svg>
);

export const IconBike = (props) => (
  <svg {...base} {...props}>
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="18.5" cy="17.5" r="3.5" />
    <path d="M5.5 17.5 10 8h4l2.5 4.5H12l-2 5" />
    <path d="M10 8H8" />
    <path d="M13.5 12.5 18.5 17.5" />
  </svg>
);

export const IconCar = (props) => (
  <svg {...base} {...props}>
    <path d="M4 16V11l2.2-5A2 2 0 0 1 8 5h8a2 2 0 0 1 1.8 1.1L20 11v5" />
    <path d="M4 16h16v2.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V17H7.5v1.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V16Z" />
    <path d="M4 11h16" />
    <circle cx="7.5" cy="13.5" r="1" />
    <circle cx="16.5" cy="13.5" r="1" />
  </svg>
);

export const IconTarget = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

export const IconArrowRight = (props) => (
  <svg {...base} {...props}>
    <line x1="4" y1="12" x2="20" y2="12" />
    <polyline points="13 5 20 12 13 19" />
  </svg>
);

export const IconCash = (props) => (
  <svg {...base} {...props}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M6 9v.01M18 15v.01" />
  </svg>
);

export const IconSparkles = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" fill="currentColor" />
    <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" fill="currentColor" />
    <path d="M5 13l.7 1.6L7.3 15l-1.6.7L5 17.3l-.7-1.6L2.7 15l1.6-.7L5 13z" fill="currentColor" />
  </svg>
);

export const IconTruck = (props) => (
  <svg {...base} {...props}>
    <rect x="1" y="7" width="13" height="10" rx="1.5" />
    <path d="M14 10h3l3 3v4h-6v-7z" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
  </svg>
);
