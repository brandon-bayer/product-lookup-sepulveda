import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_auth.js";
import { db } from "./_db.js";
import { products } from "../shared/schema.js";
import { eq, sql, desc, inArray } from "drizzle-orm";

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
        if (exact.length > 0) return res.json(await enrichWithLocations(exact));

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
        return res.json(await enrichWithLocations(results));
      }

      const all = await db.select().from(products).limit(limit).orderBy(desc(products.id));
      return res.json(await enrichWithLocations(all));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  res.status(405).end();
}

async function enrichWithLocations(rows: any[]) {
  if (rows.length === 0) return rows;
  try {
    // Fetch all location rows (small table, ~1,744 rows)
    const locs = await db.execute(sql`SELECT style_name, location FROM sepulveda_locations`);

    // Build map keyed by lowercase plain name (no trailing parentheticals)
    const locMap: Record<string, string> = {};
    for (const row of locs.rows as any[]) {
      locMap[(row.style_name as string).toLowerCase()] = row.location as string;
    }

    // Normalize product styleName: strip trailing "(…)" e.g. "(13'2W)", then lowercase
    // QFloors appends width info in parens: "Tiki Hut (13'2W)" → "tiki hut"
    const normalize = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();

    return rows.map((r: any) => ({
      ...r,
      location: r.styleName ? (locMap[normalize(r.styleName)] ?? null) : null,
    }));
  } catch {
    // Table may not exist yet — degrade gracefully
    return rows;
  }
}
