import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth, getUserById, predefinedUsers } from "./_auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const user = await getUserById(userId);
  if (!user) return res.status(401).json({ message: "Not authenticated" });

  const predefined = predefinedUsers.find(u => u.username === user.username);
  res.json({ id: user.id, username: user.username, displayName: predefined?.displayName ?? user.username });
}
