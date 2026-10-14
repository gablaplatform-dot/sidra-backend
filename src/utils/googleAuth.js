import { AppError } from "./AppError.js";

export async function verifyGoogleIdToken(idToken, expectedClientId) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw new AppError({ message: "Invalid Google token", statusCode: 401, code: "INVALID_GOOGLE_TOKEN" });
  }
  const profile = await response.json();
  if (profile.aud !== expectedClientId) {
    throw new AppError({ message: "Invalid Google audience", statusCode: 401, code: "INVALID_GOOGLE_AUDIENCE" });
  }
  if (profile.email_verified !== true && profile.email_verified !== "true") {
    throw new AppError({ message: "Your Google email isn't verified.", statusCode: 401, code: "GOOGLE_EMAIL_UNVERIFIED" });
  }
  if (!profile.email) {
    throw new AppError({ message: "Google email is required", statusCode: 400, code: "GOOGLE_EMAIL_REQUIRED" });
  }
  return profile;
}
