import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_db.js";
import { users } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import {
  predefinedUsers, COMMON_PASSWORD, hashPassword,
  comparePasswords, getUserByUsername, createToken
} from "./_auth.js";

async function ensurePredefinedUsers() {
  const hashedPassword = await hashPassword(COMMON_PASSWORD);
  for (const user of predefinedUsers) {
    const existing = await getUserByUsername(user.username);
    if (!existing) {
      await db.insert(users).values({ username: user.username, password: hashedPassword });
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    await ensurePredefinedUsers();

    const { username, noPasswordLogin } = req.body;
    const isPredefined = predefinedUsers.some(u => u.username === username);
    const user = await getUserByUsername(username);

    if (!user) return res.status(401).json({ message: "User not found" });

    if (noPasswordLogin && isPredefined) {
      const token = createToken(user.id);
      const predefined = predefinedUsers.find(u => u.username === username);
      return res.json({ token, id: user.id, username: user.username, displayName: predefined?.displayName });
    }

    const { password } = req.body;
    if (isPredefined && password === COMMON_PASSWORD) {
      const token = createToken(user.id);
      const predefined = predefinedUsers.find(u => u.username === username);
      return res.json({ token, id: user.id, username: user.username, displayName: predefined?.displayName });
    }

    if (await comparePasswords(password, user.password)) {
      const token = createToken(user.id);
      const predefined = predefinedUsers.find(u => u.username === username);
      return res.json({ token, id: user.id, username: user.username, displayName: predefined?.displayName });
    }

    return res.status(401).json({ message: "Invalid credentials" });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
}
