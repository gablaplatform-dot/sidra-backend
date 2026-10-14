const API_URL = "https://api.anthropic.com/v1/messages";

// One Messages API call that returns the model's text. `content` is a string, or an array of
// content blocks (text and image blocks). Throws on any HTTP/timeout problem so each caller can
// decide whether to fail open.
export const askClaude = async ({ apiKey, model, system, content, maxTokens = 1200, timeoutMs = 6000 }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content }] })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || `AI request failed (${response.status})`);
    return body?.content?.find((c) => c.type === "text")?.text ?? "";
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("AI request timed out");
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export const parseJsonObject = (text) => {
  const match = String(text ?? "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};
