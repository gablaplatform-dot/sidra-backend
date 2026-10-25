import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { IconClose, IconChevronLeft } from "../icons";
import LazyImg from "../LazyImg";

const AUTO_MS = 3800; // how long each picture stays before the next one slides in

// Main image + thumbnails, with a full-screen lightbox. The pictures play on their own (crossfading every few seconds)
// until someone touches, hovers or opens one; swiping or the arrows move by hand, then autoplay resumes shortly after.
export default function ProductGallery({ images, alt }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [held, setHeld] = useState(false); // pointer is over / finger is on the picture
  const [resumeAt, setResumeAt] = useState(0); // after a manual move, wait before autoplay resumes
  const touchX = useRef(null);
  const count = images.length;

  useEffect(() => setIndex(0), [images.join("|")]);

  const go = useCallback((delta) => setIndex((i) => (i + delta + count) % count), [count]);
  const manual = useCallback((delta) => {
    go(delta);
    setResumeAt(Date.now() + 7000);
  }, [go]);

  // Autoplay: only when there is more than one picture, nobody is holding it, the lightbox is closed, the tab is
  // visible and the person has not asked for reduced motion.
  useEffect(() => {
    if (count < 2 || held || lightbox) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden" || Date.now() < resumeAt) return;
      setIndex((i) => (i + 1) % count);
    }, AUTO_MS);
    return () => window.clearInterval(timer);
  }, [count, held, lightbox, resumeAt]);

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setLightbox(false);
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [lightbox, go]);

  if (!count) return null;

  return (
    <div className="pd-gallery">
      <div
        className="pd-stage"
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onTouchStart={(e) => { setHeld(true); touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          setHeld(false);
          const start = touchX.current;
          touchX.current = null;
          if (start === null) return;
          const dx = e.changedTouches[0].clientX - start;
          if (Math.abs(dx) > 40) manual(dx < 0 ? 1 : -1);
        }}
      >
        <button type="button" className="pd-stage-img" onClick={() => setLightbox(true)} aria-label={t("product.gallery.openFull")}>
          {images.map((src, i) => (
            <img key={src} src={src} alt={i === index ? alt : ""} loading={i === 0 ? "eager" : "lazy"} className={i === index ? "is-on" : ""} draggable="false" />
          ))}
        </button>
        {count > 1 ? (
          <>
            <button type="button" className="pd-nav pd-nav-prev" onClick={() => manual(-1)} aria-label={t("product.gallery.prev")}>
              <IconChevronLeft />
            </button>
            <button type="button" className="pd-nav pd-nav-next" onClick={() => manual(1)} aria-label={t("product.gallery.next")}>
              <IconChevronLeft />
            </button>
            <span className="pd-counter">
              {index + 1} / {count}
            </span>
            <div className="pd-dots" aria-hidden="true">
              {images.map((src, i) => (
                <i key={src} className={i === index ? "is-active" : ""} />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="pd-thumbs">
          {images.map((src, i) => (
            <button key={src} type="button" className={i === index ? "is-active" : ""} onClick={() => { setIndex(i); setResumeAt(Date.now() + 7000); }} aria-label={t("product.gallery.showImage", { n: i + 1 })}>
              <LazyImg src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}

      {lightbox ? (
        <div className="pd-lightbox" onClick={() => setLightbox(false)}>
          <button type="button" className="pd-lightbox-close" onClick={() => setLightbox(false)} aria-label={t("product.gallery.close")}>
            <IconClose />
          </button>
          {count > 1 ? (
            <button
              type="button"
              className="pd-nav pd-nav-prev"
              onClick={(event) => {
                event.stopPropagation();
                go(-1);
              }}
              aria-label={t("product.gallery.prev")}
            >
              <IconChevronLeft />
            </button>
          ) : null}
          <img src={images[index]} alt={alt} onClick={(event) => event.stopPropagation()} />
          {count > 1 ? (
            <button
              type="button"
              className="pd-nav pd-nav-next"
              onClick={(event) => {
                event.stopPropagation();
                go(1);
              }}
              aria-label={t("product.gallery.next")}
            >
              <IconChevronLeft />
            </button>
          ) : null}
          <span className="pd-counter">
            {index + 1} / {count}
          </span>
        </div>
      ) : null}
    </div>
  );
}
