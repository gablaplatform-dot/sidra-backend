import React from "react";

// Two-tone line icons for the mobile home: a soft filled shape under a crisp outline, drawn in currentColor
// so each tile can tint them.
const svg = (children, props) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);
const soft = { fill: "currentColor", fillOpacity: 0.16, stroke: "none" };

export const IconShopBag = (props) =>
  svg(
    <>
      <path {...soft} d="M5.2 8.5h13.6l1 11.2a1.5 1.5 0 0 1-1.5 1.6H5.7a1.5 1.5 0 0 1-1.5-1.6l1-11.2Z" />
      <path d="M5.2 8.5h13.6l1 11.2a1.5 1.5 0 0 1-1.5 1.6H5.7a1.5 1.5 0 0 1-1.5-1.6l1-11.2Z" />
      <path d="M8.5 8.5V7.2a3.5 3.5 0 0 1 7 0v1.3" />
      <path d="M9 13.2c.4 1.5 1.6 2.3 3 2.3s2.6-.8 3-2.3" />
    </>,
    props
  );

export const IconServicesWrench = (props) =>
  svg(
    <>
      <path {...soft} d="M20.6 6.4a5 5 0 0 1-6.5 6.3l-6.7 6.7a2 2 0 0 1-2.8-2.8l6.7-6.7a5 5 0 0 1 6.3-6.5l-3 3 .5 2.3 2.3.5 3.2-2.8Z" />
      <path d="M20.6 6.4a5 5 0 0 1-6.5 6.3l-6.7 6.7a2 2 0 0 1-2.8-2.8l6.7-6.7a5 5 0 0 1 6.3-6.5l-3 3 .5 2.3 2.3.5 3.2-2.8Z" />
      <circle cx="5.8" cy="17.2" r=".6" fill="currentColor" />
    </>,
    props
  );

export const IconBusTicket = (props) =>
  svg(
    <>
      <rect {...soft} x="4" y="3.5" width="16" height="14" rx="3.5" />
      <rect x="4" y="3.5" width="16" height="14" rx="3.5" />
      <path d="M4 10.5h16M4 7h16" />
      <circle cx="8.2" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="14" r="1" fill="currentColor" stroke="none" />
      <path d="M6.8 17.5V20M17.2 17.5V20" />
    </>,
    props
  );

export const IconRideCar = (props) =>
  svg(
    <>
      <path {...soft} d="M3.5 15.5v-3.6l2.1-4.7A2 2 0 0 1 7.4 6h9.2a2 2 0 0 1 1.8 1.2l2.1 4.7v3.6H3.5Z" />
      <path d="M3.5 15.5v-3.6l2.1-4.7A2 2 0 0 1 7.4 6h9.2a2 2 0 0 1 1.8 1.2l2.1 4.7v3.6" />
      <path d="M3.5 15.5h17v2.2a1 1 0 0 1-1 1H18a1 1 0 0 1-1-1v-1.2H7v1.2a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-2.2Z" />
      <path d="M3.8 11.8h16.4" />
      <circle cx="7.4" cy="13.7" r=".9" fill="currentColor" stroke="none" />
      <circle cx="16.6" cy="13.7" r=".9" fill="currentColor" stroke="none" />
    </>,
    props
  );

export const IconMenuLines = (props) =>
  svg(
    <>
      <path d="M4 8h16" />
      <path d="M4 16h10" />
    </>,
    { strokeWidth: 2.1, width: 22, height: 22, ...props }
  );

export const IconBell = (props) =>
  svg(
    <>
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.7H5l1.5-1.7Z" />
      <path d="M10 20.3a2.2 2.2 0 0 0 4 0" />
    </>,
    { width: 22, height: 22, ...props }
  );

export const IconFind = (props) =>
  svg(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>,
    { width: 22, height: 22, strokeWidth: 2, ...props }
  );

export const IconArrowUpRight = (props) =>
  svg(<path d="M7 17 17 7M9 7h8v8" />, { width: 16, height: 16, strokeWidth: 2.2, ...props });

export const IconStarFilled = (props) =>
  svg(<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.6Z" fill="currentColor" />, { width: 14, height: 14, strokeWidth: 1, ...props });
