import { supabaseAdmin, getAdminUserId, getToken } from "../_supabase-admin";

export default async function handler(req: any, res: any) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const userId = await getAdminUserId(token);
  if (!userId) return res.status(403).json({ error: "Forbidden" });

  const { userId: targetId, isAdmin } = req.body ?? {};
  if (!targetId) return res.status(400).json({ error: "Missing userId" });

  if (isAdmin) {
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: targetId, role: "admin" }, { onConflict: "user_id,role" });
  } else {
    if (targetId === userId) return res.status(400).json({ error: "Cannot demote yourself" });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", targetId).eq("role", "admin");
  }

  return res.json({ ok: true });
}
