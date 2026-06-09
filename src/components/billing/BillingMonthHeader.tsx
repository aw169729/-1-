import { useState } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  formatBillingMonthLabel,
  formatStartDateLabel,
  nextMonth,
  prevMonth,
  setBillingMonth,
  type BillingMonthInfo,
} from "@/lib/billing-month";

interface Props {
  info: BillingMonthInfo;
  onChanged: () => void;
  showSwitchButton?: boolean;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BillingMonthHeader({ info, onChanged, showSwitchButton = true }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const next = nextMonth(info.month);

  const goPrev = async () => {
    try {
      const prev = prevMonth(info.month);
      // Keep startDate aligned to first day of that month if no record exists.
      const [y, m] = prev.split("-");
      await setBillingMonth(prev, `${y}-${m}-01`);
      onChanged();
    } catch (e) {
      console.error(e);
      toast.error("שגיאה במעבר לחודש קודם");
    }
  };

  const goNext = async () => {
    try {
      const nxt = nextMonth(info.month);
      const [y, m] = nxt.split("-");
      await setBillingMonth(nxt, `${y}-${m}-01`);
      onChanged();
    } catch (e) {
      console.error(e);
      toast.error("שגיאה במעבר לחודש הבא");
    }
  };

  const confirmManualSwitch = async () => {
    if (!date) {
      toast.error("יש לבחור תאריך");
      return;
    }
    setSaving(true);
    try {
      await setBillingMonth(next, date);
      toast.success(`עברנו ל${formatBillingMonthLabel(next)}`);
      setOpen(false);
      onChanged();
    } catch (e) {
      console.error(e);
      toast.error("שגיאה במעבר חודש");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goPrev} aria-label="חודש קודם">
          <ChevronRight className="h-5 w-5" />
        </Button>
        <div>
          <div className="text-lg font-bold text-foreground">
            {formatBillingMonthLabel(info.month)}
          </div>
          <div className="text-xs text-muted-foreground">
            מ-{formatStartDateLabel(info.startDate)}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={goNext} aria-label="חודש הבא">
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>
      {showSwitchButton && (
        <Button onClick={() => setOpen(true)} variant="default">
          <ArrowLeftRight className="ml-2 h-4 w-4" />
          עבור לחודש הבא
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">
              מעבר לחודש {formatBillingMonthLabel(next)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="start-date">החודש החדש מתחיל מתאריך</Label>
            <Input
              id="start-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              dir="ltr"
            />
          </div>
          <DialogFooter className="sm:justify-start">
            <Button onClick={confirmManualSwitch} disabled={saving}>
              {saving ? "שומר..." : "אשר מעבר"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}