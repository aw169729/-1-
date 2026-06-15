import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getAdminUserId(token: string): Promise<string | null> {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    const { data } = await supabaseAdmin.from("user_roles").select("id")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    return data ? user.id : null;
  } catch { return null; }
}

export default async function handler(req: any, res: any) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const userId = await getAdminUserId(token);
    if (!userId) return res.status(403).json({ error: "Forbidden" });

    const { userId: targetId, isAdmin } = req.body ?? {};
    if (!targetId) return res.status(400).json({ error: "Missing userId" });

    if (isAdmin) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: targetId, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      if (targetId === userId) return res.status(400).json({ error: "Cannot demote yourself" });
      await supabaseAdmin.from("user_roles").delete().eq("user_id", targetId).eq("role", "admin");
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message ?? "Server error" });
  }
}
