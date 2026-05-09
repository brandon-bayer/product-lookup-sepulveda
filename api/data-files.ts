import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_auth.js";
import { db } from "./_db.js";
import { syncLog } from "../shared/schema.js";
import { desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  if (req.method !== "GET") return res.status(405).end();

  try {
    // Auto-create table if it doesn't exist yet
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sepulveda_sync_log (
        id SERIAL PRIMARY KEY,
        synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
        product_count INTEGER NOT NULL DEFAULT 0
      )
    `);

    const [latest] = await db
      .select()
      .from(syncLog)
      .orderBy(desc(syncLog.syncedAt))
      .limit(1);

    if (!latest) return res.json([]);

    return res.json([
      {
        name: "QFloors Sync",
        size: latest.productCount,
        date: latest.syncedAt.toISOString(),
      },
    ]);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
}
