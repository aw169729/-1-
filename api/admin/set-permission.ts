import { supabaseAdmin, getAdminUserId, getToken } from "../_supabase-admin";

export default async function handler(req: any, res: any) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const userId = await getAdminUserId(token);
  if (!userId) return res.status(403).json({ error: "Forbidden" });

  const { userId: targetId, page, can_view, can_edit } = req.body ?? {};
  if (!targetId || !page) return res.status(400).json({ error: "Missing fields" });

  await supabaseAdmin.from("user_page_permissions").upsert(
    { user_id: targetId, page, can_view, can_edit, updated_at: new Date().toISOString() },
    { onConflict: "user_id,page" }
  );

  return res.json({ ok: true });
}
