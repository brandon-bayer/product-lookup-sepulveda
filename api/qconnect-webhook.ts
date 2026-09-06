import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_db.js";
import { sql } from "drizzle-orm";

// Capture endpoint for QFloors QConnect "Notification URL".
// Logs every request (method, query, headers, body) to qconnect_log so we can
// inspect exactly what QFloors sends before building a real importer.
// Intentionally permissive: accepts any method and always returns 200.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const body =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? null);
    await db.execute(sql`
      INSERT INTO qconnect_log (method, query, headers, body)
      VALUES (
        ${req.method ?? ""},
        ${(req.url ?? "") + " | " + JSON.stringify(req.query ?? {})},
        ${JSON.stringify(req.headers ?? {})},
        ${body}
      )
    `);
  } catch (err) {
    // Never fail the caller — we want QFloors to see a clean 200 even if
    // logging hiccups, so its own "Test URL" check reports success.
    console.error("qconnect-webhook log error", err);
  }
  res.status(200).json({ ok: true });
}
