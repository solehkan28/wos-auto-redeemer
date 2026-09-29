import { config } from "./config.js";

export async function fetchValidatedWosCodes() {
  const response = await fetch(config.wosControlUrl, {
    headers: {
      "Accept": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`WOSControl HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data?.codes)) {
    throw new Error("WOSControl response does not contain codes[]");
  }

  return data.codes
    .filter((item) =>
      item?.game_type === "wos" &&
      item?.validation_status === "validated" &&
      item?.giftcode &&
      item?.date
    )
    .map((item) => ({
      giftcode: String(item.giftcode).trim(),
      date: new Date(item.date),
      raw: item
    }))
    .filter((item) => !Number.isNaN(item.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}