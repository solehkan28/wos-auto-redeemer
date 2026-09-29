export const maxDuration = 30;

import { runListener } from "../src/listener.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  // Optional protection for manual calls.
  // Vercel Cron requests can be protected by the CRON_SECRET mechanism
  // when the deployment is configured accordingly. For local/manual use,
  // set x-listener-secret if LISTENER_SECRET is configured.
  const configuredSecret = process.env.LISTENER_SECRET;
  if (configuredSecret) {
    const supplied = req.headers["x-listener-secret"];
    if (supplied !== configuredSecret) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized"
      });
    }
  }

  try {
    const result = await runListener();
    return res.status(200).json(result);
  } catch (error) {
    console.error("[LISTENER ERROR]", error);

    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}