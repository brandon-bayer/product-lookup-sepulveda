import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_auth.js";
import { db } from "./_db.js";
import { products } from "../../shared/schema.js";
import { eq, sql } from "drizzle-orm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  if (req.method !== "GET") return res.status(405).end();

  try {
    const sku = req.query.sku as string;
    const normalized = sku?.startsWith("?") ? sku.slice(1) : sku;

    let [product] = await db.select().from(products).where(eq(products.sku, normalized));
    if (!product) {
      [product] = await db.select().from(products)
        .where(sql`LOWER(${products.sku}) = LOWER(${normalized})`);
    }

    if (!product) return res.status(404).json({ message: `Product ${sku} not found` });
    return res.json(product);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
}
