import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatHebrewMonth } from "@/lib/hebrew-date";

interface Props {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export function MonthSwitcher({ year, month, onChange }: Props) {
  const prev = () => {
    const m = month - 1;
    if (m < 0) onChange(year - 1, 11);
    else onChange(year, m);
  };
  const next = () => {
    const m = month + 1;
    if (m > 11) onChange(year + 1, 0);
    else onChange(year, m);
  };

  return (
    <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-[var(--shadow-card)] border border-border/40">
      <Button variant="ghost" size="icon" onClick={prev} aria-label="חודש קודם">
        <ChevronRight className="h-5 w-5" />
      </Button>
      <div className="min-w-[140px] text-center text-base font-semibold text-foreground">
        {formatHebrewMonth(year, month)}
      </div>
      <Button variant="ghost" size="icon" onClick={next} aria-label="חודש הבא">
        <ChevronLeft className="h-5 w-5" />
      </Button>
    </div>
  );
}