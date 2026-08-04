import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";

// Wraps the devpay/hive mobile money gateway (https://hive-sooty-eight.vercel.app).
// Deposits are async: this call only tells us the USSD prompt was sent — the real
// success/failure lands later on our webhook. Withdrawals respond synchronously.
export class MobileMoneyService {
  assertConfigured() {
    if (!env.mobileMoneyApiKey || !env.mobileMoneyApiPassword) {
      throw new AppError({
        message: "Mobile money gateway is not configured",
        statusCode: 503,
        code: "MOBILE_MONEY_NOT_CONFIGURED"
      });
    }
  }

  async postJson(path, body) {
    let response;
    try {
      response = await fetch(`${env.mobileMoneyBaseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (networkError) {
      throw new AppError({
        message: "Unable to reach the mobile money gateway",
        statusCode: 502,
        code: "MOBILE_MONEY_UNREACHABLE",
        details: { error: networkError.message }
      });
    }

    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  }

  // Sends a USSD deposit prompt to `phone`. The gateway calls our webhook URLs later with the
  // outcome — this response only confirms the prompt request itself was accepted.
  async initiateDeposit({ amount, phone, reference, successUrl, failedUrl }) {
    this.assertConfigured();

    const result = await this.postJson("/process_payment", {
      amount: String(Math.round(Number(amount))),
      number: phone,
      refer: reference,
      username: env.mobileMoneyApiKey,
      password: env.mobileMoneyApiPassword,
      "success-re-url": successUrl,
      "failed-re-url": failedUrl
    });

    if (!result.ok) {
      throw new AppError({
        message: result.data?.message || "Unable to start the mobile money payment",
        statusCode: 502,
        code: "MOBILE_MONEY_DEPOSIT_FAILED",
        details: result.data
      });
    }

    return result.data;
  }

  // Pays `amount` out to `phone` from our devpay account balance. Responds synchronously —
  // there is no webhook for withdrawals.
  async initiateWithdrawal({ amount, phone, reference, userId }) {
    this.assertConfigured();

    const result = await this.postJson("/devpay_withdraw", {
      amount: String(Math.round(Number(amount))),
      number: phone,
      refer: reference,
      userid: userId,
      username: env.mobileMoneyApiKey,
      password: env.mobileMoneyApiPassword
    });

    if (!result.ok) {
      throw new AppError({
        message: result.data?.message || "The mobile money payout failed",
        statusCode: 502,
        code: "MOBILE_MONEY_WITHDRAWAL_FAILED",
        details: result.data
      });
    }

    return result.data;
  }
}
