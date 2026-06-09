import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClientRow } from "@/lib/client-matching";

export interface NoteGroup {
  fromRow: number; // 0-based index in the trips array
  toRow: number;   // inclusive
  clientId: string;
}

interface Props {
  open: boolean;
  tripCount: number;
  clients: ClientRow[];
  saving: boolean;
  onConfirm: (groups: NoteGroup[]) => Promise<void>;
  onCancel: () => void;
}

export function AssignNoteDialog({ open, tripCount, clients, saving, onConfirm, onCancel }: Props) {
  const [groups, setGroups] = useState<NoteGroup[]>([
    { fromRow: 0, toRow: tripCount - 1, clientId: "" },
  ]);

  // Reset when dialog opens
  const handleOpenChange = (o: boolean) => {
    if (o) setGroups([{ fromRow: 0, toRow: tripCount - 1, clientId: "" }]);
    else onCancel();
  };

  const updateClient = (idx: number, clientId: string) => {
    setGroups((prev) => prev.map((g, i) => (i === idx ? { ...g, clientId } : g)));
  };

  const addSplit = () => {
    const last = groups[groups.length - 1];
    if (last.toRow - last.fromRow < 1) return; // need at least 2 rows to split
    const mid = Math.floor((last.fromRow + last.toRow) / 2);
    setGroups((prev) => [
      ...prev.slice(0, -1),
      { ...last, toRow: mid },
      { fromRow: mid + 1, toRow: last.toRow, clientId: "" },
    ]);
  };

  const removeGroup = (idx: number) => {
    if (groups.length === 1) return;
    setGroups((prev) => {
      const next = [...prev];
      // Merge range into previous group
      if (idx === 0) {
        next[1] = { ...next[1], fromRow: next[0].fromRow };
      } else {
        next[idx - 1] = { ...next[idx - 1], toRow: next[idx].toRow };
      }
      next.splice(idx, 1);
      return next;
    });
  };

  const allAssigned = groups.every((g) => g.clientId);

  const rowLabel = (from: number, to: number) => {
    if (from === to) return `שורה ${from + 1}`;
    return `שורות ${from + 1}–${to + 1}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>שיוך פתק לנסיעות</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          נמצאו <strong>{tripCount}</strong> נסיעות ללא פתק ומספר נסיעה.
          בחר לאיזה פתק (לקוח) לשייך אותן — או פצל לקבוצות.
        </p>

        <div className="space-y-3">
          {groups.map((g, idx) => (
            <div key={idx} className="flex items-end gap-2 rounded-lg border bg-muted/40 p-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">{rowLabel(g.fromRow, g.toRow)}</Label>
                <Select value={g.clientId} onValueChange={(v) => updateClient(idx, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר לקוח / פתק" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {groups.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeGroup(idx)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSplit}
          disabled={groups[groups.length - 1].toRow - groups[groups.length - 1].fromRow < 1}
        >
          <Plus className="ml-1 h-4 w-4" />
          פצל לקבוצה נוספת
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={() => onConfirm(groups)} disabled={!allAssigned || saving}>
            {saving ? "שומר..." : "שמור נסיעות"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
