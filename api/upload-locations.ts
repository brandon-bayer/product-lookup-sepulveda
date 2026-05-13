import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_auth.js";
import { db } from "./_db.js";
import { sql } from "drizzle-orm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  if (req.method !== "POST") return res.status(405).end();

  try {
    const { rows } = req.body as { rows: Array<{ styleName: string; location: string }> };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "No rows provided" });
    }

    // Ensure table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sepulveda_locations (
        id SERIAL PRIMARY KEY,
        style_name TEXT NOT NULL UNIQUE,
        location TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    let count = 0;
    for (const row of rows) {
      const name = row.styleName?.trim();
      const loc = row.location?.trim();
      if (!name || !loc) continue;

      await db.execute(sql`
        INSERT INTO sepulveda_locations (style_name, location, updated_at)
        VALUES (${name}, ${loc}, NOW())
        ON CONFLICT (style_name) DO UPDATE SET
          location = EXCLUDED.location,
          updated_at = NOW()
      `);
      count++;
    }

    return res.json({ message: `Uploaded ${count} locations`, count });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
}
