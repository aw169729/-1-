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

    const { email, password, isAdmin } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return res.status(500).json({ error: error.message });

    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: isAdmin ? "admin" : "user" });
    return res.json({ id: created.user.id });
  } catch (e: any) {
    return res.status(500).json({ error: e.message ?? "Server error" });
  }
}
