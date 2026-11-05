import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const MOBILE_BREAKPOINT = 640; // matches Tailwind's `sm` — below this, right-side drawers become bottom sheets.
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
};

// A small centered bar that reads as a drag handle, signaling "this is a bottom sheet" on
// mobile; hidden on desktop where the panel is a right-side drawer instead.
export const SheetHandle = () => (
  <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
    <div className="w-10 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(148,163,184,0.5)' }} />
  </div>
);

export const DrawerShell = ({ open, children, onClose }) => {
  const isMobile = useIsMobile();
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 bg-slate-900/30 z-[998]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-x-0 bottom-0 max-h-[88vh] w-full sm:inset-x-auto sm:bottom-auto sm:top-20 sm:right-0 sm:h-[calc(100vh-5rem)] sm:max-h-none sm:w-[560px] lg:w-[640px] bg-white z-[999] border-t sm:border-t-0 sm:border-l rounded-t-2xl sm:rounded-none flex flex-col"
            style={{ borderColor: '#E2E8F0' }}
            initial={isMobile ? { y: '100%', opacity: 0 } : { x: 40, opacity: 0 }}
            animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
            exit={isMobile ? { y: '100%', opacity: 0 } : { x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <SheetHandle />
            {children}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};
