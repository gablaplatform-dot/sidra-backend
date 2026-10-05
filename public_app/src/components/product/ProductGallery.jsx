import React, { useCallback, useEffect, useState } from "react";

import { IconClose, IconChevronLeft } from "../icons";
import LazyImg from "../LazyImg";

// Main image + thumbnails, with a full-screen lightbox (arrow keys / Esc / swipe-free buttons).
export default function ProductGallery({ images, alt }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const count = images.length;

  useEffect(() => setIndex(0), [images.join("|")]);

  const go = useCallback((delta) => setIndex((i) => (i + delta + count) % count), [count]);

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
      <div className="pd-stage">
        <button type="button" className="pd-stage-img" onClick={() => setLightbox(true)} aria-label="Open full-size image">
          <LazyImg key={images[index]} src={images[index]} alt={alt} />
        </button>
        {count > 1 ? (
          <>
            <button type="button" className="pd-nav pd-nav-prev" onClick={() => go(-1)} aria-label="Previous image">
              <IconChevronLeft />
            </button>
            <button type="button" className="pd-nav pd-nav-next" onClick={() => go(1)} aria-label="Next image">
              <IconChevronLeft />
            </button>
            <span className="pd-counter">
              {index + 1} / {count}
            </span>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="pd-thumbs">
          {images.map((src, i) => (
            <button key={src} type="button" className={i === index ? "is-active" : ""} onClick={() => setIndex(i)} aria-label={`Show image ${i + 1}`}>
              <LazyImg src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}

      {lightbox ? (
        <div className="pd-lightbox" onClick={() => setLightbox(false)}>
          <button type="button" className="pd-lightbox-close" onClick={() => setLightbox(false)} aria-label="Close">
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
              aria-label="Previous image"
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
              aria-label="Next image"
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
