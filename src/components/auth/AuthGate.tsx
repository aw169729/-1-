import { useAuth, type PageKey } from "@/contexts/auth-context";
import { Navigate } from "@tanstack/react-router";
import { LoginForm } from "./LoginForm";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const PAGE_ROUTES: Record<PageKey, string> = {
  trips: "/",
  payments: "/payments",
  clients: "/clients",
  reports: "/reports",
  settings: "/settings",
};

export function AuthGate({ page, children }: { page?: PageKey; children: ReactNode }) {
  const { session, loading, permsLoaded, canView, isAdmin, signOut } = useAuth();
  if (loading || (session && !permsLoaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session) return <LoginForm />;
  if (page && !canView(page)) {
    // Redirect silently to the first page the user is allowed to view.
    // Never expose page chrome / "no permission" message for unauthorized routes.
    const order: PageKey[] = ["trips", "payments", "clients", "reports", "settings"];
    const firstAllowed = order.find((p) => canView(p));
    if (firstAllowed) return <Navigate to={PAGE_ROUTES[firstAllowed]} replace />;
    if (isAdmin) return <Navigate to="/" replace />;
    // User has no permissions at all — show neutral screen with sign-out only.
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold">אין לך הרשאות</h1>
        <p className="text-muted-foreground">פנה למנהל המערכת</p>
        <Button onClick={() => signOut()}>
          <LogOut className="ml-2 h-4 w-4" />
          יציאה
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}