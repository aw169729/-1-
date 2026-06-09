import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type PageKey = "trips" | "payments" | "clients" | "reports" | "settings";

export const PAGES: { key: PageKey; label: string }[] = [
  { key: "trips", label: "דף הבית (נסיעות)" },
  { key: "payments", label: "דרישת תשלום" },
  { key: "clients", label: "לקוחות" },
  { key: "reports", label: "דוחות" },
  { key: "settings", label: "הגדרות" },
];

interface PagePerm { page: string; can_view: boolean; can_edit: boolean }

interface AuthCtx {
  session: Session | null;
  loading: boolean;
  permsLoaded: boolean;
  isAdmin: boolean;
  permissions: PagePerm[];
  canView: (p: PageKey) => boolean;
  canEdit: (p: PageKey) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

// Patch global fetch (browser only) to attach the Supabase bearer token to
// TanStack server-function calls so requireSupabaseAuth middleware sees it.
if (typeof window !== "undefined" && !(window as any).__lvAuthFetchPatched) {
  (window as any).__lvAuthFetchPatched = true;
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as Request).url;
      if (url && url.includes("/_serverFn/")) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
          if (!headers.has("authorization")) {
            headers.set("authorization", `Bearer ${token}`);
          }
          init = { ...(init || {}), headers };
        }
      }
    } catch {
      // ignore — fall through to original fetch
    }
    return origFetch(input as any, init);
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<PagePerm[]>([]);
  const [permsLoaded, setPermsLoaded] = useState(false);

  const loadRolesAndPerms = useCallback(async (uid: string) => {
    const [{ data: roles }, { data: perms }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("user_page_permissions").select("page, can_view, can_edit").eq("user_id", uid),
    ]);
    let admin = !!roles?.some((r) => r.role === "admin");
    if (!admin) {
      // Bootstrap: if no admins exist, promote this user.
      const { count } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if (!count || count === 0) {
        await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
        admin = true;
      }
    }
    setIsAdmin(admin);
    setPermissions(perms ?? []);
    setPermsLoaded(true);
  }, []);

  const refresh = useCallback(async () => {
    if (session?.user) await loadRolesAndPerms(session.user.id);
  }, [session, loadRolesAndPerms]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setPermsLoaded(false);
        setTimeout(() => loadRolesAndPerms(s.user.id), 0);
      } else {
        setIsAdmin(false);
        setPermissions([]);
        setPermsLoaded(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadRolesAndPerms(data.session.user.id).finally(() => setLoading(false));
      } else {
        setPermsLoaded(true);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadRolesAndPerms]);

  const canView = useCallback(
    (p: PageKey) => isAdmin || !!permissions.find((x) => x.page === p)?.can_view,
    [isAdmin, permissions]
  );
  const canEdit = useCallback(
    (p: PageKey) => isAdmin || !!permissions.find((x) => x.page === p)?.can_edit,
    [isAdmin, permissions]
  );

  return (
    <Ctx.Provider
      value={{
        session,
        loading,
        permsLoaded,
        isAdmin,
        permissions,
        canView,
        canEdit,
        refresh,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}