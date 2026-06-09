import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function ensureAdmin(userId: string) {
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  if (!count || count === 0) {
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
    return true;
  }
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}