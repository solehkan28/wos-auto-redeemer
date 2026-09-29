import { buildPayload } from "./signature.js";
import { config } from "./config.js";

function buildFormData(payload) {
  const form = new FormData();

  for (const [key, value] of Object.entries(payload)) {
    form.append(key, String(value));
  }

  return form;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function classifyResponse(httpStatus, body) {
  const data = body && typeof body === "object" ? body : {};
  const msg = String(data.msg || "").trim().toUpperCase();
  const errCode = Number(data.err_code);

  // ONLY these two outcomes are terminal.
  if (data.code === 0 || errCode === 20000 || msg === "SUCCESS") {
    return { terminal: true, status: "SUCCESS" };
  }

  if (errCode === 40008 || msg === "RECEIVED.") {
    return { terminal: true, status: "RECEIVED" };
  }

  // Everything else is retryable, including 429, SAME TYPE EXCHANGE,
  // unknown API errors, malformed responses, and other HTTP errors.
  return {
    terminal: false,
    status: "RETRY",
    retryAfterMs: httpStatus === 429 ? 5000 : 2000
  };
}

export async function redeemOne({ fid, server, giftcode }) {
  const payload = buildPayload({
    fid,
    server,
    giftcode
  });

  const form = buildFormData(payload);

  try {
    const response = await fetch(config.redeemUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://wos-giftcode.centurygame.com",
        "Referer": "https://wos-giftcode.centurygame.com/",
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
      },
      body: form,
      signal: AbortSignal.timeout(8_000)
    });

    const responseText = await response.text();
    const body = parseJson(responseText);
    const classification = classifyResponse(response.status, body);

    return {
      ok: classification.terminal,
      terminal: classification.terminal,
      status: classification.status,
      retryAfterMs: classification.retryAfterMs || 0,
      httpStatus: response.status,
      response: responseText,
      data: body
    };
  } catch (error) {
    return {
      ok: false,
      terminal: false,
      status: "RETRY",
      retryAfterMs: 2000,
      httpStatus: null,
      response: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
