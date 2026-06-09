import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("אימייל או סיסמה שגויים");
      return;
    }
    toast.success("התחברת בהצלחה");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Toaster position="top-center" richColors />
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-xl border border-border/60 bg-card p-8 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-1 text-center">
          <div className="mx-auto mb-3 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
            <LogIn className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">כניסה למערכת</h1>
          <p className="text-sm text-muted-foreground">הזן אימייל וסיסמה</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">אימייל</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">סיסמה</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            dir="ltr"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <LogIn className="ml-2 h-4 w-4" />}
          התחבר
        </Button>
      </form>
    </div>
  );
}