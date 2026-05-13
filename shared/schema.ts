import { pgTable, text, serial, integer, timestamp, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Use prefixed table names to isolate this application's data
export const users = pgTable("sepulveda_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const products = pgTable("sepulveda_products", {
  id: serial("id").primaryKey(),
  sku: text("sku").unique(),
  styleName: text("style_name").notNull(),
  styleNumber: text("style_number").notNull(),
  colorName: text("color_name").notNull(),
  colorNumber: text("color_number").notNull(),
  cost: text("cost").notNull(),
  price: text("price").notNull(),
  manufacturer: text("manufacturer").notNull(),
  width: text("width"),
  backing: text("backing"),
});

export const scans = pgTable("sepulveda_scans", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
});

// Define relations after all tables are defined
export const usersRelations = relations(users, ({ many }) => ({
  scans: many(scans)
}));

export const productsRelations = relations(products, ({ many }) => ({
  scans: many(scans)
}));

export const scansRelations = relations(scans, ({ one }) => ({
  // This relation now works with products that may have null SKUs
  product: one(products, {
    fields: [scans.sku],
    references: [products.sku],
    relationName: "scan_to_product"
  }),
  user: one(users, {
    fields: [scans.userId],
    references: [users.id]
  })
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertProductSchema = createInsertSchema(products).pick({
  sku: true,
  styleName: true,
  styleNumber: true,
  colorName: true,
  colorNumber: true,
  cost: true,
  price: true,
  manufacturer: true,
  width: true,
  backing: true,
});

export const insertScanSchema = createInsertSchema(scans).pick({
  sku: true,
  timestamp: true,
  userId: true,
});

export const showroomLocations = pgTable("sepulveda_locations", {
  id: serial("id").primaryKey(),
  styleName: text("style_name").notNull().unique(), // private label name (matches product.styleName)
  location: text("location").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const syncLog = pgTable("sepulveda_sync_log", {
  id: serial("id").primaryKey(),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
  productCount: integer("product_count").notNull().default(0),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertScan = z.infer<typeof insertScanSchema>;

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Scan = typeof scans.$inferSelect;
