import { supabaseAdmin, getAdminUserId, getToken } from "../_supabase-admin";

export default async function handler(req: any, res: any) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const userId = await getAdminUserId(token);
  if (!userId) return res.status(403).json({ error: "Forbidden" });

  const { userId: targetId } = req.body ?? {};
  if (!targetId) return res.status(400).json({ error: "Missing userId" });
  if (targetId === userId) return res.status(400).json({ error: "Cannot delete yourself" });

  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ ok: true });
}
