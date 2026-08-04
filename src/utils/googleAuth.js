import { AppError } from "./AppError.js";

export async function verifyGoogleIdToken(idToken, expectedClientId) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) {
    throw new AppError({ message: "Invalid Google token", statusCode: 401, code: "INVALID_GOOGLE_TOKEN" });
  }
  const profile = await response.json();
  if (profile.aud !== expectedClientId) {
    throw new AppError({ message: "Invalid Google audience", statusCode: 401, code: "INVALID_GOOGLE_AUDIENCE" });
  }
  if (!profile.email) {
    throw new AppError({ message: "Google email is required", statusCode: 400, code: "GOOGLE_EMAIL_REQUIRED" });
  }
  return profile;
}
