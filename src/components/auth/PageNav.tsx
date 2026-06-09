import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth, type PageKey } from "@/contexts/auth-context";
import { Car as CarIcon, Wallet, Users, FileDown, Settings as SettingsIcon, LogOut, ShieldCheck } from "lucide-react";

const ITEMS: { key: PageKey; to: string; label: string; Icon: any }[] = [
  { key: "trips", to: "/", label: "נסיעות", Icon: CarIcon },
  { key: "payments", to: "/payments", label: "דרישת תשלום", Icon: Wallet },
  { key: "reports", to: "/reports", label: "דוחות PDF", Icon: FileDown },
  { key: "clients", to: "/clients", label: "לקוחות", Icon: Users },
  { key: "settings", to: "/settings", label: "הגדרות", Icon: SettingsIcon },
];

export function PageNav({ current }: { current?: PageKey }) {
  const { canView, isAdmin, signOut } = useAuth();
  const allowed = ITEMS.filter((i) => canView(i.key));
  // For non-admin users with 0 or 1 allowed pages, hide all navigation links
  // (they have nowhere else to legitimately go). Show only the sign-out button.
  const showLinks = isAdmin || allowed.length > 1;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showLinks &&
        allowed
          .filter((i) => i.key !== current)
          .map(({ key, to, label, Icon }) => (
            <Button key={key} asChild variant="outline">
              <Link to={to}>
                <Icon className="ml-2 h-4 w-4" />
                {label}
              </Link>
            </Button>
          ))}
      {isAdmin && (
        <Button asChild variant="outline">
          <Link to="/users">
            <ShieldCheck className="ml-2 h-4 w-4" />
            משתמשים
          </Link>
        </Button>
      )}
      <Button variant="outline" onClick={() => signOut()}>
        <LogOut className="ml-2 h-4 w-4" />
        יציאה
      </Button>
    </div>
  );
}
