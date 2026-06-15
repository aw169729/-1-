import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function getAdminUserId(token: string): Promise<string | null> {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  return data ? user.id : null;
}

export function getToken(req: any): string | null {
  return req.headers.authorization?.replace("Bearer ", "") ?? null;
}
