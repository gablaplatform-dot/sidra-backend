export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

let googleIdentityLoadPromise;
export const loadGoogleIdentity = () => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (googleIdentityLoadPromise) return googleIdentityLoadPromise;
  googleIdentityLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google sign-in"));
    document.head.appendChild(script);
  });
  return googleIdentityLoadPromise;
};
