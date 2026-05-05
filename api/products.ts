import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_auth.js";
import { db } from "./_db.js";
import { products } from "../../shared/schema.js";
import { eq, sql, desc } from "drizzle-orm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { method } = req;

  // GET /api/products?q=query&limit=200
  if (method === "GET") {
    try {
      const q = req.query.q as string;
      const limit = Number(req.query.limit) || 200;

      if (q && q.trim()) {
        const trimmed = q.startsWith("?") ? q.slice(1) : q;

        // Exact SKU match first
        const exact = await db.select().from(products)
          .where(eq(products.sku, trimmed)).limit(1);
        if (exact.length > 0) return res.json(exact);

        // Full-text ILIKE search
        const results = await db.select().from(products)
          .where(sql`
            LOWER(${products.styleName}) ILIKE ${"%" + trimmed.toLowerCase() + "%"} OR
            LOWER(${products.styleNumber}) ILIKE ${"%" + trimmed.toLowerCase() + "%"} OR
            LOWER(${products.colorName}) ILIKE ${"%" + trimmed.toLowerCase() + "%"} OR
            LOWER(${products.colorNumber}) ILIKE ${"%" + trimmed.toLowerCase() + "%"} OR
            LOWER(${products.manufacturer}) ILIKE ${"%" + trimmed.toLowerCase() + "%"} OR
            LOWER(COALESCE(${products.sku}, '')) ILIKE ${"%" + trimmed.toLowerCase() + "%"}
          `)
          .limit(limit);
        return res.json(results);
      }

      const all = await db.select().from(products).limit(limit).orderBy(desc(products.id));
      return res.json(all);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  res.status(405).end();
}
