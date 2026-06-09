import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureAdmin } from "./admin-users.server";

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await ensureAdmin(context.userId);
    return { isAdmin };
  });

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await ensureAdmin(context.userId))) throw new Error("Forbidden");
    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const users = usersData?.users ?? [];
    const ids = users.map((u) => u.id);
    let roles: { user_id: string; role: string }[] = [];
    let perms: { user_id: string; page: string; can_view: boolean; can_edit: boolean }[] = [];
    if (ids.length > 0) {
      const r = await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids);
      if (r.error) console.error("listUsers roles error:", r.error);
      roles = (r.data ?? []) as any;
      const p = await supabaseAdmin
        .from("user_page_permissions")
        .select("user_id, page, can_view, can_edit")
        .in("user_id", ids);
      if (p.error) console.error("listUsers perms error:", p.error);
      perms = (p.data ?? []) as any;
    }
    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        roles: roles.filter((r) => r.user_id === u.id).map((r) => r.role),
        permissions: perms.filter((p) => p.user_id === u.id),
      })),
    };
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; isAdmin: boolean }) => d)
  .handler(async ({ data, context }) => {
    if (!(await ensureAdmin(context.userId))) throw new Error("Forbidden");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error) throw error;
    const role = data.isAdmin ? "admin" : "user";
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role });
    return { id: created.user.id };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    if (!(await ensureAdmin(context.userId))) throw new Error("Forbidden");
    if (data.userId === context.userId) throw new Error("Cannot delete yourself");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const updateUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; password: string }) => d)
  .handler(async ({ data, context }) => {
    if (!(await ensureAdmin(context.userId))) throw new Error("Forbidden");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw error;
    return { ok: true };
  });

export const updateUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; email: string }) => d)
  .handler(async ({ data, context }) => {
    if (!(await ensureAdmin(context.userId))) throw new Error("Forbidden");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: data.email,
      email_confirm: true,
    });
    if (error) throw error;
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; isAdmin: boolean }) => d)
  .handler(async ({ data, context }) => {
    if (!(await ensureAdmin(context.userId))) throw new Error("Forbidden");
    if (data.isAdmin) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      if (data.userId === context.userId) throw new Error("Cannot demote yourself");
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    }
    return { ok: true };
  });

export const setUserPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; page: string; can_view: boolean; can_edit: boolean }) => d)
  .handler(async ({ data, context }) => {
    if (!(await ensureAdmin(context.userId))) throw new Error("Forbidden");
    await supabaseAdmin
      .from("user_page_permissions")
      .upsert(
        { user_id: data.userId, page: data.page, can_view: data.can_view, can_edit: data.can_edit, updated_at: new Date().toISOString() },
        { onConflict: "user_id,page" }
      );
    return { ok: true };
  });