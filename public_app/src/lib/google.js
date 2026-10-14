export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

let googleIdentityLoadPromise;
export const loadGoogleIdentity = () => {
  if (isNativeApp()) return Promise.resolve(nativeGoogleShim());
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

// ---- Native app (Capacitor) ---------------------------------------------------------------
// Google refuses its web sign-in inside an embedded WebView, so the Android/iOS app asks the
// phone's own Google account sheet for an ID token instead. The token has the web client ID as
// its audience, so the API verifies it exactly like a browser sign-in.
export const GOOGLE_IOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID || "";

export const isNativeApp = () => {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

let nativeReady;
const initNativeGoogle = async () => {
  if (!nativeReady) {
    nativeReady = import("@capgo/capacitor-social-login").then(async ({ SocialLogin }) => {
      await SocialLogin.initialize({
        google: {
          webClientId: GOOGLE_CLIENT_ID,
          ...(GOOGLE_IOS_CLIENT_ID ? { iOSClientId: GOOGLE_IOS_CLIENT_ID, iOSServerClientId: GOOGLE_CLIENT_ID } : {})
        }
      });
      return SocialLogin;
    });
    nativeReady.catch(() => { nativeReady = undefined; });
  }
  return nativeReady;
};

export const nativeGoogleIdToken = async () => {
  const SocialLogin = await initNativeGoogle();
  // No `scopes` option: passing one switches the plugin to an authorisation flow that needs extra MainActivity code. The ID token already carries email and profile.
  const { result } = await SocialLogin.login({ provider: "google" });
  if (!result?.idToken) throw new Error("Google did not return a sign-in token. Please try again.");
  return result.idToken;
};

const GOOGLE_G = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';

// Stand-in for window.google.accounts.id, so the pages' existing sign-in code runs unchanged:
// renderButton draws a native-styled button, and tapping it opens the phone's Google sheet.
const nativeGoogleShim = () => {
  let callback = () => {};
  return {
    accounts: {
      id: {
        initialize: (config) => { callback = config.callback || callback; },
        prompt: () => {}, // no one-tap sheet in the app
        renderButton: (el, options = {}) => {
          const label = options.text === "signin_with" ? "Sign in with Google" : "Continue with Google";
          el.innerHTML = "";
          const button = document.createElement("button");
          button.type = "button";
          button.className = "google-native-button";
          button.innerHTML = `${GOOGLE_G}<span>${label}</span>`;
          button.addEventListener("click", async () => {
            if (button.disabled) return;
            button.disabled = true;
            try {
              callback({ credential: await nativeGoogleIdToken() });
            } catch (error) {
              const message = String(error?.message || "");
              // Closing the Google sheet is not an error worth showing.
              if (!/cancel|dismiss|\[16\]|12501/i.test(message)) {
                window.alert(`Google sign-in failed: ${message || "please try again."}`);
              }
            } finally {
              button.disabled = false;
            }
          });
          el.appendChild(button);
        }
      }
    }
  };
};
