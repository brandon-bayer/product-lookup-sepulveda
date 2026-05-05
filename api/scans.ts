import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_auth.js";
import { db } from "./_db.js";
import { scans } from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  if (req.method === "POST") {
    try {
      const { sku } = req.body;
      if (!sku) return res.status(400).json({ message: "SKU required" });
      const normalizedSku = sku.startsWith("?") ? sku.slice(1) : sku;
      const [scan] = await db.insert(scans)
        .values({ sku: normalizedSku, userId })
        .returning();
      return res.json(scan);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  if (req.method === "GET") {
    try {
      const results = await db.select().from(scans)
        .where(eq(scans.userId, userId))
        .orderBy(desc(scans.timestamp));
      return res.json(results);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  res.status(405).end();
}
