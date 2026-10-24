import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { IconArrowRight, IconCalendar, IconCheck, IconLock, IconSearch } from "../icons";

const STEPS = ["find", "unlock", "book"];
const initial = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

function FindScreen({ providers }) {
  const { t } = useTranslation();
  return (
    <div className="hp-screen-body">
      <div className="hp-search"><IconSearch /> <span>{t("landing.phone.findQuery")}</span></div>
      <ul className="hp-list">
        {providers.map((p) => (
          <li key={p.id}>
            <span className="hp-avatar" style={p.media?.avatarUrl ? { backgroundImage: `url("${p.media.avatarUrl}")` } : undefined}>
              {!p.media?.avatarUrl ? initial(p.businessName) : null}
            </span>
            <span className="hp-list-text">
              <strong>{p.businessName}</strong>
              <small>★ {p.ratingAvg ? p.ratingAvg.toFixed(1) : t("landing.phone.newProvider")} · {t("landing.phone.verified")}</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UnlockScreen({ provider }) {
  const { t } = useTranslation();
  return (
    <div className="hp-screen-body">
      <div className="hp-sheet">
        <span className="hp-lock"><IconLock /></span>
        <strong>{t("landing.phone.unlockTitle")}</strong>
        <small>{t("landing.phone.unlockSub")}</small>
        <div className="hp-field">
          <small>{t("landing.phone.phoneLabel")}</small>
          <span>+256 7•• ••• •••</span>
        </div>
        <span className="hp-pay">{t("landing.phone.pay")}</span>
        <small className="hp-foot">{t("landing.phone.noAccount")}</small>
      </div>
      {provider ? <small className="hp-for">{provider.businessName}</small> : null}
    </div>
  );
}

function BookScreen() {
  const { t } = useTranslation();
  return (
    <div className="hp-screen-body">
      <div className="hp-sheet">
        <span className="hp-lock hp-lock-green"><IconCalendar /></span>
        <strong>{t("landing.phone.bookTitle")}</strong>
        <ol className="hp-steps">
          <li className="is-done"><i><IconCheck /></i>{t("landing.phone.stepSent")}</li>
          <li className="is-done"><i><IconCheck /></i>{t("landing.phone.stepApproved")}</li>
          <li className="is-now"><i /> {t("landing.phone.stepPay")}</li>
        </ol>
        <span className="hp-pay">{t("landing.phone.payNow")}</span>
      </div>
    </div>
  );
}

// Pinned: as the page scrolls past, the phone swaps between the three steps and the matching chip lights up.
export default function ContactPhone({ providers }) {
  const { t } = useTranslation();
  const sectionRef = useRef(null);
  const [step, setStep] = useState(0);
  const shown = providers.slice(0, 3);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const header = document.querySelector(".site-header");
      const hdr = header ? header.offsetHeight : 76;
      const rect = section.getBoundingClientRect();
      const stickyH = window.innerHeight - hdr;
      const travel = Math.max(1, rect.height - stickyH);
      const p = Math.min(1, Math.max(0, (hdr - rect.top) / travel));
      setStep(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="hp" ref={sectionRef}>
      <div className="hp-sticky">
        <div className="hp-copy">
          <h2>{t("landing.phone.title")}</h2>
          <div className="hp-chips" role="tablist" aria-label={t("landing.phone.stepsAria")}>
            {STEPS.map((key, i) => (
              <button key={key} type="button" role="tab" aria-selected={step === i} className={step === i ? "is-active" : ""} onClick={() => setStep(i)}>
                <b>{i + 1}</b> {t(`landing.phone.${key}`)}
              </button>
            ))}
          </div>
          <p>{t("landing.phone.body")}</p>
          <Link to="/search" className="hp-cta">{t("landing.phone.cta")} <IconArrowRight /></Link>
        </div>

        <div className="hp-phone" aria-hidden="true">
          <span className="hp-notch" />
          <div className={`hp-screen ${step === 0 ? "is-on" : ""}`}><FindScreen providers={shown} /></div>
          <div className={`hp-screen ${step === 1 ? "is-on" : ""}`}><UnlockScreen provider={shown[0]} /></div>
          <div className={`hp-screen ${step === 2 ? "is-on" : ""}`}><BookScreen /></div>
        </div>
      </div>
    </section>
  );
}
