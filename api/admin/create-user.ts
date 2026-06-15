import { supabaseAdmin, getAdminUserId, getToken } from "../_supabase-admin";

export default async function handler(req: any, res: any) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const userId = await getAdminUserId(token);
  if (!userId) return res.status(403).json({ error: "Forbidden" });

  const { email, password, isAdmin } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return res.status(500).json({ error: error.message });

  const role = isAdmin ? "admin" : "user";
  await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role });

  return res.json({ id: created.user.id });
}
