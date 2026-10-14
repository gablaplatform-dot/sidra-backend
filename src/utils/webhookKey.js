import crypto from "crypto";

import { env } from "../config/env.js";

// The secret that rides in every payment-callback URL we give the mobile money gateway (ticket, order, booking,
// ride, ...). Derived from JWT_SECRET so there is nothing extra to configure.
export const webhookKey = () => crypto.createHmac("sha256", env.jwtSecret).update("mobile-money-webhook").digest("hex").slice(0, 40);
