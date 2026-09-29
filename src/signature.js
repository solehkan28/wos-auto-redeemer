import crypto from "node:crypto";
import { config } from "./config.js";

function encodePythonQuote(value) {
  // Python urllib.parse.quote(..., safe="~()*!.'")
  // encodeURIComponent leaves the same RFC3986-safe set plus -_.,
  // and importantly leaves ~()*!.' unescaped.
  return encodeURIComponent(String(value));
}

export function makeSign(data) {
  const parts = [];

  for (const key of Object.keys(data).sort()) {
    let value = data[key];

    if (value !== null && typeof value === "object") {
      value = JSON.stringify(value);
    }

    parts.push(`${key}=${encodePythonQuote(value)}`);
  }

  const raw = parts.join("&") + config.redeemSecret;

  return crypto
    .createHash("md5")
    .update(raw, "utf8")
    .digest("hex");
}

export function buildPayload({ fid, server, giftcode }) {
  const data = {
    cdk: giftcode,
    fid: fid,
    kid: server,
    time: Math.floor(Date.now() / 1000)
  };

  data.sign = makeSign(data);
  return data;
}