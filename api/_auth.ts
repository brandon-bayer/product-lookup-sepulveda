import { db } from "./_db.js";
import { users } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const scryptAsync = promisify(scrypt);

export const predefinedUsers = [
  { displayName: "Brandon Bayer", username: "brandonbayer" },
  { displayName: "Cristy Aguilar", username: "cristyaguilar" },
  { displayName: "Edward Maldonaldo", username: "edwardmaldonaldo" },
  { displayName: "Leticia Piña", username: "leticiapina" },
  { displayName: "Luis Piña", username: "luispina" },
  { displayName: "Lulu Arnold", username: "luluarnold" },
  { displayName: "Marco Bisnar", username: "marcobisnar" },
  { displayName: "Marilyn Nelson", username: "marilynnelson" },
  { displayName: "Mark Haloossim", username: "markhaloossim" },
  { displayName: "Matthew Green", username: "matthewgreen" },
  { displayName: "Matt Mark", username: "mattmark" },
  { displayName: "Richard Garcia", username: "richardgarcia" },
  { displayName: "Ruben Rodriguez", username: "rubenrodriguez" },
  { displayName: "Shaneen Gottula", username: "shaneengottula" },
];

export const COMMON_PASSWORD = "contempo2025";

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export async function getUserByUsername(username: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user;
}

export async function getUserById(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

// Simple JWT-based session (no cookies needed on Vercel)
import { createHmac } from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "contempo-product-search-secret";

export function createToken(userId: number): string {
  const payload = JSON.stringify({ userId, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  const encoded = Buffer.from(payload).toString("base64");
  const sig = createHmac("sha256", SESSION_SECRET).update(encoded).digest("hex");
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    const [encoded, sig] = token.split(".");
    const expectedSig = createHmac("sha256", SESSION_SECRET).update(encoded).digest("hex");
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64").toString());
    if (payload.exp < Date.now()) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: VercelRequest): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function requireAuth(req: VercelRequest, res: VercelResponse): Promise<number | null> {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return payload.userId;
}
