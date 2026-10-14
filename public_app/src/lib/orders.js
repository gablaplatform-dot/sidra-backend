import { request } from "./api";
import { trackInterest } from "./tracking";

// Cash orders: nothing is charged online, the order goes straight to the seller and the buyer pays
// them on delivery or pickup. (Online orders use the same call with paymentMethod "online": the seller accepts first, then the buyer pays from My orders.)

export const initialOrderDetails = (session) => ({
  name: session?.user?.name || "",
  phone: session?.user?.phone || "",
  method: "delivery",
  address: "",
  location: null, // { address, lat, lng, source } from the map or place search
  notes: ""
});

// `delivery` is false for services, which have no delivery or pickup choice.
export const validateOrderDetails = (details, { delivery = true } = {}) => {
  if (!details.name.trim()) return "Enter your name.";
  if (details.phone.replace(/\D/g, "").length < 7) return "Enter a phone number the seller can reach you on.";
  if (delivery && details.method === "delivery" && !details.address.trim()) return "Choose where to deliver: pick it on the map or search for the place.";
  return "";
};

// The address is what the seller reads; the coordinates (when the place came from the map or the search
// suggestions) are saved alongside it for directions and are never shown to the buyer.
const fulfillmentFor = (details) => {
  if (details.method !== "delivery") return { method: details.method };
  const place = details.location;
  const point = place && Number.isFinite(place.lat) && Number.isFinite(place.lng) ? { lat: place.lat, lng: place.lng, locationSource: place.source } : {};
  return { method: "delivery", address: details.address.trim(), ...point };
};

// paymentMethod "cash": pay the seller on delivery or pickup. "online": pay by mobile money once the seller accepts.
export const placeCashOrder = async ({ providerId, items, details, delivery = true, paymentMethod = "cash" }) => {
  const order = await request("/engagement/orders", {
    method: "POST",
    body: JSON.stringify({
      providerId,
      items,
      paymentMethod,
      customer: { name: details.name.trim(), phone: details.phone.trim(), notes: details.notes.trim() || undefined },
      fulfillment: delivery ? fulfillmentFor(details) : undefined
    })
  });
  for (const item of items) if (item.listingId) trackInterest({ type: "order", listingId: item.listingId });
  return order;
};
