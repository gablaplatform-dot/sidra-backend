import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

// Admin sessions stay short; everyone else stays signed in until they sign out (the app also renews the token as it is used).
export const sessionTtlSeconds = (role, ttlSeconds) => (role === "admin" ? ttlSeconds : Math.max(ttlSeconds, env.jwtAppTtlSeconds));

export const signAccessToken = ({ payload, secret, issuer, ttlSeconds }) =>
  jwt.sign(payload, secret, { issuer, expiresIn: sessionTtlSeconds(payload?.role, ttlSeconds) });

export const verifyAccessToken = ({ token, secret, issuer }) => jwt.verify(token, secret, { issuer });
