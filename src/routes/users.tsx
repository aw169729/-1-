import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth, PAGES, type PageKey } from "@/contexts/auth-context";
import { PageNav } from "@/components/auth/PageNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, KeyRound, Plus, ShieldCheck, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/users")({
  component: UsersPage,
});

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
  permissions: { page: string; can_view: boolean; can_edit: boolean }[];
};

async function adminFetch(path: string, body: object, token: string) {
  const res = await fetch(`/api/admin/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "שגיאה");
  return json;
}

function UsersPage() {
  const { isAdmin, loading, session } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState(false);

  const token = () => session?.access_token ?? "";

  const refresh = useCallback(async () => {
    if (!session?.access_token) return;
    setBusy(true);
    try {
      const r = await adminFetch("list-users", {}, session.access_token);
      setUsers(r.users ?? []);
    } catch (e: any) {
      toast.error(e.message ?? "שגיאה בטעינה");
    } finally {
      setBusy(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/" });
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  if (loading) return <div className="p-8 text-center">טוען...</div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      <header className="border-b border-border/60 bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">ניהול משתמשים</h1>
          </div>
          <PageNav current="users" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">משתמשים ({users.length})</h2>
          <CreateUserDialog
            onCreate={async (email, password, isAdminFlag) => {
              await adminFetch("create-user", { email, password, isAdmin: isAdminFlag }, token());
              toast.success("משתמש נוצר");
              await refresh();
            }}
          />
        </div>

        <div className="space-y-3">
          {busy && users.length === 0 ? (
            <div className="rounded-xl bg-card p-8 text-center text-muted-foreground">טוען...</div>
          ) : users.length === 0 ? (
            <div className="rounded-xl bg-card p-8 text-center text-muted-foreground">אין משתמשים</div>
          ) : (
            users.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                isSelf={u.id === session?.user?.id}
                onDelete={async () => {
                  if (!confirm(`למחוק את ${u.email}?`)) return;
                  await adminFetch("delete-user", { userId: u.id }, token());
                  toast.success("נמחק");
                  await refresh();
                }}
                onChangePassword={async (pw) => {
                  await adminFetch("update-password", { userId: u.id, password: pw }, token());
                  toast.success("הסיסמה עודכנה");
                }}
                onChangeEmail={async (em) => {
                  await adminFetch("update-email", { userId: u.id, email: em }, token());
                  toast.success("המייל עודכן");
                  await refresh();
                }}
                onToggleAdmin={async (val) => {
                  await adminFetch("set-role", { userId: u.id, isAdmin: val }, token());
                  toast.success("עודכן");
                  await refresh();
                }}
                onSetPerm={async (page, can_view, can_edit) => {
                  await adminFetch("set-permission", { userId: u.id, page, can_view, can_edit }, token());
                  await refresh();
                }}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function CreateUserDialog({
  onCreate,
}: {
  onCreate: (email: string, password: string, isAdmin: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdminFlag, setIsAdminFlag] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="ml-2 h-4 w-4" /> הוסף משתמש
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>משתמש חדש</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>אימייל</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label>סיסמה</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              placeholder="לפחות 6 תווים"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isAdmin"
              checked={isAdminFlag}
              onCheckedChange={(v) => setIsAdminFlag(!!v)}
            />
            <Label htmlFor="isAdmin">מנהל (גישה מלאה)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          <Button
            disabled={saving || !email || password.length < 6}
            onClick={async () => {
              setSaving(true);
              try {
                await onCreate(email, password, isAdminFlag);
                setOpen(false);
                setEmail("");
                setPassword("");
                setIsAdminFlag(false);
              } catch (e: any) {
                toast.error(e.message ?? "שגיאה");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "יוצר..." : "צור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserCard({
  user,
  isSelf,
  onDelete,
  onChangePassword,
  onChangeEmail,
  onToggleAdmin,
  onSetPerm,
}: {
  user: AdminUser;
  isSelf: boolean;
  onDelete: () => Promise<void>;
  onChangePassword: (pw: string) => Promise<void>;
  onChangeEmail: (email: string) => Promise<void>;
  onToggleAdmin: (val: boolean) => Promise<void>;
  onSetPerm: (page: string, can_view: boolean, can_edit: boolean) => Promise<void>;
}) {
  const isAdminUser = user.roles.includes("admin");
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState(user.email);

  const getPerm = (page: PageKey) =>
    user.permissions.find((p) => p.page === page) ?? { can_view: false, can_edit: false };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold" dir="ltr">{user.email}</div>
          <div className="text-xs text-muted-foreground">
            {isAdminUser ? "מנהל" : "משתמש"}
            {isSelf && " (אתה)"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`admin-${user.id}`}
              checked={isAdminUser}
              disabled={isSelf}
              onCheckedChange={(v) => onToggleAdmin(!!v)}
            />
            <Label htmlFor={`admin-${user.id}`}>מנהל</Label>
          </div>
          <Dialog open={pwOpen} onOpenChange={setPwOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <KeyRound className="ml-2 h-4 w-4" /> סיסמה
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>שינוי סיסמה — {user.email}</DialogTitle>
              </DialogHeader>
              <Input
                type="text"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                dir="ltr"
                placeholder="סיסמה חדשה (לפחות 6 תווים)"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setPwOpen(false)}>ביטול</Button>
                <Button
                  disabled={pw.length < 6}
                  onClick={async () => {
                    try {
                      await onChangePassword(pw);
                      setPw("");
                      setPwOpen(false);
                    } catch (e: any) {
                      toast.error(e.message ?? "שגיאה");
                    }
                  }}
                >
                  שמור
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={emailOpen} onOpenChange={(o) => { setEmailOpen(o); if (o) setNewEmail(user.email); }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Mail className="ml-2 h-4 w-4" /> מייל
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>שינוי מייל — {user.email}</DialogTitle>
              </DialogHeader>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                dir="ltr"
                placeholder="כתובת מייל חדשה"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEmailOpen(false)}>ביטול</Button>
                <Button
                  disabled={!newEmail || newEmail === user.email || !/.+@.+\..+/.test(newEmail)}
                  onClick={async () => {
                    try {
                      await onChangeEmail(newEmail);
                      setEmailOpen(false);
                    } catch (e: any) {
                      toast.error(e.message ?? "שגיאה");
                    }
                  }}
                >
                  שמור
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            disabled={isSelf}
            onClick={async () => {
              try {
                await onDelete();
              } catch (e: any) {
                toast.error(e.message ?? "שגיאה");
              }
            }}
            className="text-destructive"
          >
            <Trash2 className="ml-2 h-4 w-4" /> מחק
          </Button>
        </div>
      </div>

      {!isAdminUser && (
        <div className="mt-4 border-t pt-3">
          <div className="mb-2 text-sm font-medium">הרשאות לפי דף</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {PAGES.map((p) => {
              const perm = getPerm(p.key);
              return (
                <div key={p.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">{p.label}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-xs">
                      <Checkbox
                        checked={perm.can_view}
                        onCheckedChange={(v) =>
                          onSetPerm(p.key, !!v, !!v ? perm.can_edit : false)
                        }
                      />
                      צפייה
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <Checkbox
                        checked={perm.can_edit}
                        onCheckedChange={(v) =>
                          onSetPerm(p.key, !!v ? true : perm.can_view, !!v)
                        }
                      />
                      עריכה
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
