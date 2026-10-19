import React from "react";
import { useTranslation } from "react-i18next";

import DeliveryLocationPicker from "./DeliveryLocationPicker";

// Contact + delivery details for a cash order, shared by the order dialog and the cart.
export default function OrderDetailsFields({ value, onChange, delivery = true }) {
  const { t } = useTranslation();
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <>
      <label className="field">
        <span>{t("form.yourName")}</span>
        <input value={value.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" />
      </label>
      <label className="field">
        <span>{t("form.phone")}</span>
        <input value={value.phone} onChange={(e) => set({ phone: e.target.value })} placeholder={t("form.phonePlaceholder")} inputMode="tel" autoComplete="tel" />
      </label>
      {delivery ? (
        <>
          <div className="field">
            <span>{t("form.getItHow")}</span>
            <div className="od-choice">
              <button type="button" className={value.method === "delivery" ? "is-active" : ""} onClick={() => set({ method: "delivery" })}>
                {t("form.delivery")}
              </button>
              <button type="button" className={value.method === "pickup" ? "is-active" : ""} onClick={() => set({ method: "pickup" })}>
                {t("form.pickup")}
              </button>
            </div>
          </div>
          {value.method === "delivery" ? (
            <div className="field">
              <span>{t("form.whereDeliver")}</span>
              <DeliveryLocationPicker
                value={value.location}
                onChange={(location) => set({ location, address: location?.address || "" })}
              />
            </div>
          ) : null}
        </>
      ) : null}
      <label className="field">
        <span>{t("form.noteLabel")}</span>
        <input value={value.notes} onChange={(e) => set({ notes: e.target.value })} placeholder={t("form.notePlaceholder")} />
      </label>
    </>
  );
}
