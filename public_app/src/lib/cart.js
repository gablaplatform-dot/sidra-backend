// A device-local cart (localStorage), keyed by listingId -> quantity. Kept client-side until
// checkout so browsing doesn't need an account; checkout itself still requires signing in (same
// as Buy Now), since real money moves at that point.
const KEY = "gabla_cart";

const readCart = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeCart = (cart) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(cart));
  } catch {
    // Storage unavailable (private browsing, quota) — the cart just won't persist across reloads.
  }
  window.dispatchEvent(new Event("gabla-cart-changed"));
};

export const getCartItems = () => {
  const cart = readCart();
  return Object.entries(cart).map(([listingId, quantity]) => ({ listingId, quantity }));
};

export const getCartCount = () => getCartItems().reduce((sum, item) => sum + item.quantity, 0);

export const addToCart = (listingId, quantity = 1) => {
  const cart = readCart();
  cart[listingId] = Math.max(1, Math.min(99, (cart[listingId] || 0) + quantity));
  writeCart(cart);
};

export const setCartQuantity = (listingId, quantity) => {
  const cart = readCart();
  const q = Math.max(1, Math.min(99, Number(quantity) || 1));
  cart[listingId] = q;
  writeCart(cart);
};

export const removeFromCart = (listingId) => {
  const cart = readCart();
  delete cart[listingId];
  writeCart(cart);
};

export const clearCart = () => {
  writeCart({});
};
