import React from "react";

// Contact + delivery details for a cash order, shared by the order dialog and the cart.
export default function OrderDetailsFields({ value, onChange, delivery = true }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <>
      <label className="field">
        <span>Your name</span>
        <input value={value.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" />
      </label>
      <label className="field">
        <span>Phone number</span>
        <input value={value.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="e.g. +256 700 000000" inputMode="tel" autoComplete="tel" />
      </label>
      {delivery ? (
        <>
          <div className="field">
            <span>How do you want to get it?</span>
            <div className="od-choice">
              <button type="button" className={value.method === "delivery" ? "is-active" : ""} onClick={() => set({ method: "delivery" })}>
                Delivery
              </button>
              <button type="button" className={value.method === "pickup" ? "is-active" : ""} onClick={() => set({ method: "pickup" })}>
                I&apos;ll pick it up
              </button>
            </div>
          </div>
          {value.method === "delivery" ? (
            <label className="field">
              <span>Delivery address</span>
              <input value={value.address} onChange={(e) => set({ address: e.target.value })} placeholder="Area, street, landmark" autoComplete="street-address" />
            </label>
          ) : null}
        </>
      ) : null}
      <label className="field">
        <span>Note for the seller (optional)</span>
        <input value={value.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Anything the seller should know" />
      </label>
    </>
  );
}
