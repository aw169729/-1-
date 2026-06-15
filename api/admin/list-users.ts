import { supabaseAdmin, getAdminUserId, getToken } from "../_supabase-admin";

export default async function handler(req: any, res: any) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const userId = await getAdminUserId(token);
  if (!userId) return res.status(403).json({ error: "Forbidden" });

  const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return res.status(500).json({ error: error.message });

  const users = usersData?.users ?? [];
  const ids = users.map((u: any) => u.id);

  let roles: any[] = [];
  let perms: any[] = [];
  if (ids.length > 0) {
    const r = await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids);
    roles = r.data ?? [];
    const p = await supabaseAdmin
      .from("user_page_permissions")
      .select("user_id, page, can_view, can_edit")
      .in("user_id", ids);
    perms = p.data ?? [];
  }

  return res.json({
    users: users.map((u: any) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      roles: roles.filter((r: any) => r.user_id === u.id).map((r: any) => r.role),
      permissions: perms.filter((p: any) => p.user_id === u.id),
    })),
  });
}
