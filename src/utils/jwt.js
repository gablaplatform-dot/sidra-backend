import jwt from "jsonwebtoken";

export const signAccessToken = ({ payload, secret, issuer, ttlSeconds }) =>
  jwt.sign(payload, secret, { issuer, expiresIn: ttlSeconds });

export const verifyAccessToken = ({ token, secret, issuer }) => jwt.verify(token, secret, { issuer });

