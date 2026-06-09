// gmail-direct-v2
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { FileDown, FileSpreadsheet, ArrowRight, ChevronLeft, ChevronRight, Save, Upload, X, MessageCircle, Mail } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  fetchBillingMonth,
  formatBillingMonthLabel,
  nextMonth,
  prevMonth,
  type BillingMonthInfo,
} from "@/lib/billing-month";
import {
  fetchBusinessSettings,
  saveBusinessSettings,
  renderTemplate,
  DEFAULT_WHATSAPP_TEMPLATE,
  type BusinessSettings,
} from "@/lib/business-settings";
import { computeClientPrice } from "@/lib/client-price";
import { ensureHebrewFont } from "@/lib/pdf-font";
import { formatDateHebrew } from "@/lib/hebrew-date";
import { ImportOldDebtsButton } from "@/components/settings/ImportOldDebtsButton";
import { useVat } from "@/contexts/vat-context";
import { openGmailCompose } from "@/lib/gmail";
import { fetchAllRows } from "@/lib/fetch-all";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/contexts/auth-context";
import { PageNav } from "@/components/auth/PageNav";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "דוחות — ניהול נסיעות" },
      { name: "description", content: "הפקת דוחות חודשיים של נסיעות, ייצוא ל-PDF ו-Excel, שליחת דוחות ללקוחות והתאמת תבניות מסמכים לעסק." },
      { property: "og:title", content: "דוחות — ניהול נסיעות" },
      { property: "og:description", content: "הפקת דוחות חודשיים, ייצוא ל-PDF ו-Excel ושליחת דוחות ללקוחות." },
      { property: "og:url", content: "https://asher-weinberger.com/reports" },
    ],
    links: [{ rel: "canonical", href: "https://asher-weinberger.com/reports" }],
  }),
  component: () => (
    <AuthGate page="reports">
      <ReportsPage />
    </AuthGate>
  ),
});

interface ClientRow {
  id: string;
  name: string;
  notes: string | null;
  markup_type: string | null;
  markup_value: number | null;
  markup_includes_vat: boolean | null;
  aliases: string[] | null;
  show_driver_price: boolean | null;
  show_full_price_breakdown: boolean | null;
  phone: string | null;
  email: string | null;
  sort_by_date: string | null;
  sort_by_origin: string | null;
}

interface TripRow {
  trip_number: string;
  trip_date: string | null;
  origin: string | null;
  destination: string | null;
  passenger_name: string | null;
  phone: string | null;
  price: number | null;
  client: string | null;
  client_id: string | null;
  billing_month: string | null;
  notes: string | null;
}

interface ClientGroup {
  client: ClientRow;
  trips: TripRow[];
  totalDriver: number;
  totalClient: number;
}

const reverseText = (str: string): string => {
  const parts = str.split(/(\d+[%₪.]?\d*|[a-zA-Z0-9@._%+\-]+)/g);
  return parts
    .map((part) =>
      /(\d+[%₪.]?\d*|[a-zA-Z0-9@._%+\-]+)/.test(part)
        ? part
        : part.split("").reverse().join(""),
    )
    .reverse()
    .join("");
};

function ReportsPage() {
  const { canView } = useAuth();
  const [settings, setSettings] = useState<BusinessSettings>({
    business_name: "",
    business_phone: "",
    business_email: "",
    global_note: "",
    business_logo: "",
    whatsapp_template: DEFAULT_WHATSAPP_TEMPLATE,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [billing, setBilling] = useState<BillingMonthInfo | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { vatRate } = useVat();

  const load = useCallback(async () => {
    setLoading(true);
    const [s, b, c] = await Promise.all([
      fetchBusinessSettings(),
      fetchBillingMonth(),
      fetchAllRows<ClientRow>((from, to) =>
        supabase
          .from("clients")
          .select("id, name, notes, markup_type, markup_value, markup_includes_vat, aliases, show_driver_price, show_full_price_breakdown, phone, email, sort_by_date, sort_by_origin")
          .order("name")
          .range(from, to),
      ),
    ]);
    setSettings(s);
    setBilling(b);
    const monthToLoad = selectedMonth || b.month;
    if (!selectedMonth) setSelectedMonth(b.month);
    const { data: allTrips } = await fetchAllRows<TripRow>((from, to) =>
      supabase
        .from("trips")
        .select("trip_number, trip_date, origin, destination, passenger_name, phone, price, client, client_id, billing_month, notes")
        .eq("billing_month", monthToLoad)
        .range(from, to),
    );
    setTrips(allTrips);
    if (!c.error) setClients(c.data);
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeSync(["trips", "clients", "payments", "settings"], load);

  const groups = useMemo<ClientGroup[]>(() => {
    if (!selectedMonth) return [];
    const byId = new Map<string, ClientRow>();
    const byAlias = new Map<string, ClientRow>();
    for (const c of clients) {
      byId.set(c.id, c);
      if (c.name?.trim()) byAlias.set(c.name.trim(), c);
      for (const a of c.aliases ?? []) {
        const an = (a ?? "").trim();
        if (an && !byAlias.has(an)) byAlias.set(an, c);
      }
    }
    const map = new Map<string, ClientGroup>();
    for (const t of trips) {
      if (t.billing_month !== selectedMonth) continue;
      let cfg: ClientRow | null = null;
      if (t.client_id) cfg = byId.get(t.client_id) ?? null;
      if (!cfg && t.client) cfg = byAlias.get(t.client.trim()) ?? null;
      if (!cfg) continue;
      let g = map.get(cfg.id);
      if (!g) {
        g = { client: cfg, trips: [], totalDriver: 0, totalClient: 0 };
        map.set(cfg.id, g);
      }
      g.trips.push(t);
      g.totalDriver += Number(t.price ?? 0);
      g.totalClient += Number(computeClientPrice(t.price, cfg) ?? 0);
    }
    for (const g of map.values()) {
      const sd = (g.client.sort_by_date as "asc" | "desc" | "none" | null) || "none";
      const so = (g.client.sort_by_origin as "asc" | "desc" | "none" | null) || "none";
      // Default: keep existing behavior (date ascending) if user hasn't chosen anything.
      const effectiveDate = sd === "none" && so === "none" ? "asc" : sd;
      g.trips.sort((a, b) => {
        if (effectiveDate !== "none") {
          const da = a.trip_date ? new Date(a.trip_date).getTime() : 0;
          const db = b.trip_date ? new Date(b.trip_date).getTime() : 0;
          if (da !== db) return effectiveDate === "asc" ? da - db : db - da;
        }
        if (so !== "none") {
          const oa = (a.origin ?? "").trim();
          const ob = (b.origin ?? "").trim();
          const cmp = oa.localeCompare(ob, "he");
          if (cmp !== 0) return so === "asc" ? cmp : -cmp;
        }
        return 0;
      });
    }
    return Array.from(map.values()).sort((a, b) => a.client.name.localeCompare(b.client.name, "he"));
  }, [trips, clients, selectedMonth]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await saveBusinessSettings(settings);
      toast.success("ההגדרות נשמרו");
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בשמירת ההגדרות");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogoUpload = (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("יש לבחור קובץ תמונה או PDF");
      return;
    }
    if (file.size  < 2 * 1024 * 1024) {
      toast.error("התמונה גדולה מדי (מקסימום 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      // For PDFs or non-image data, store as-is
      if (!file.type.startsWith("image/")) {
        setSettings((s) => ({ ...s, business_logo: dataUrl }));
        return;
      }
      // Downscale image to keep PDF small
      const img = new Image();
      img.onload = () => {
        const MAX_W = 600;
        const MAX_H = 600;
        let w = img.width;
        let h = img.height;
        const ratio = Math.min(MAX_W / w, MAX_H / h, 1);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setSettings((s) => ({ ...s, business_logo: dataUrl }));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const isPng = file.type === "image/png";
        const out = isPng
          ? canvas.toDataURL("image/png")
          : canvas.toDataURL("image/jpeg", 0.85);
        setSettings((s) => ({ ...s, business_logo: out }));
      };
      img.onerror = () => {
        setSettings((s) => ({ ...s, business_logo: dataUrl }));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const generatePdfForGroup = async (g: ClientGroup, monthLabel: string, zip?: JSZip): Promise<void> => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    await ensureHebrewFont(doc);
    doc.setFont("Heebo", "normal");

    const pageW = doc.internal.pageSize.getWidth();
    const margin = 12;
    const BLUE: [number, number, number] = [26, 115, 232];
    const ROW_LIGHT: [number, number, number] = [219, 234, 254]; // #dbeafe
    const ROW_ALT: [number, number, number] = [191, 219, 254]; // #bfdbfe
    let y = 10;

    const headerTop = y;
    const headerRightX = pageW - margin;

    // Right: business name + contact
    let rightY = headerTop + 6;
    let rightContentLeft = headerRightX; // tracks leftmost extent of right-side content
    if (settings.business_name) {
      doc.setFontSize(18);
      doc.setFont("Heebo", "bold");
      const nameStr = reverseText(settings.business_name);
      doc.text(nameStr, headerRightX, rightY, { align: "right" });
      rightContentLeft = Math.min(rightContentLeft, headerRightX - doc.getTextWidth(nameStr));
      doc.setFont("Heebo", "normal");
      rightY += 6;
    }
    const contactLines = [settings.business_phone, settings.business_email]
      .map((s) => (s ?? "").trim())
      .filter(Boolean);
    if (contactLines.length) {
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const contactStr = contactLines.join("  |  ");
      doc.text(contactStr, headerRightX, rightY, { align: "right" });
      rightContentLeft = Math.min(rightContentLeft, headerRightX - doc.getTextWidth(contactStr));
      doc.setTextColor(0, 0, 0);
      rightY += 4;
    }

    // Left: timestamp above logo, then logo (80x80 px ≈ ~21mm)
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(timestamp, margin, headerTop + 4, { align: "left" });
    doc.setTextColor(0, 0, 0);

    let leftBottom = headerTop + 4;
    if (settings.business_logo) {
      try {
        const fmt = settings.business_logo.startsWith("data:image/png") ? "PNG" : "JPEG";
        // Fit logo into a max box matching the red-marked area (~90×70mm),
        // preserving the original aspect ratio so any uploaded logo looks right.
        const maxW = 55;
        const maxH = 35;
        const props = doc.getImageProperties(settings.business_logo);
        const ratio = props.width / props.height;
        let drawW = maxW;
        let drawH = drawW / ratio;
        if (drawH  < maxH) {
          drawH = maxH;
          drawW = drawH * ratio;
        }
        doc.addImage(settings.business_logo, fmt, margin, headerTop + 6, drawW, drawH, "logo", "FAST");
        leftBottom = headerTop + 6 + drawH;
      } catch (e) {
        console.warn("Logo render failed", e);
      }
    }

    y = rightY + 1;

    // Blue divider — only spans width of right-side content (name/contact)
    doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.setLineWidth(0.7);
    const dividerLeft = Math.max(rightContentLeft - 2, margin);
    doc.line(dividerLeft, y, pageW - margin, y);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    y += 2;

    // Title row: report title + month/year subtitle
    doc.setFontSize(14);
    doc.setFont("Heebo", "bold");
    doc.text(
      reverseText(`דוח נסיעות: ${g.client.name}`),
      pageW - margin,
      y,
      { align: "right" },
    );
    doc.setFont("Heebo", "normal");
    y += 5;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const year = monthLabel.match(/\d{4}/)?.[0] ?? "";
    const monthOnly = monthLabel.replace(/\s*\d{4}/, "").trim();
    const monthHe = reverseText(monthOnly);
    doc.text(monthHe, pageW - margin, y, { align: "right" });
    if (year) {
      const w = doc.getTextWidth(monthHe);
      doc.text(year + " ", pageW - margin - w, y, { align: "right" });
    }
    doc.setTextColor(0, 0, 0);
    y += 3;

    // Client notes (if any)
    if (g.client.notes && g.client.notes.trim()) {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      const notesLines = doc.splitTextToSize(reverseText(g.client.notes), pageW - margin * 2);
      doc.text(notesLines, pageW - margin, y, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += notesLines.length * 4 + 2;
    }

    const summaryStartY = y;
    const showDriver = !!g.client.show_driver_price;
    const showFull = !!g.client.show_full_price_breakdown;
    const isPercent = g.client.markup_type === "percent";
    const noVat = !!g.client.markup_includes_vat;
    const vatMul = noVat ? 0 : vatRate / 100;
    const vatPlus = noVat ? 1 : 1 + vatMul;
    const vatLabel = reverseText('סה"כ מע"מ');
    const vatTotalLabel = reverseText('סה"כ כולל מע"מ');
    const driverTotalLabel = reverseText('סה"כ מחירון לנהג');
    const clientTotalLabel = reverseText('סה"כ מחיר ללקוח');
    const payTotalLabel = reverseText('סה"כ לתשלום');
    const summaryRows: [string, string][] = showFull
      ? [
          ["₪" + g.totalDriver.toFixed(2), driverTotalLabel],
          ["₪" + g.totalClient.toFixed(2), clientTotalLabel],
          ["₪" + (g.totalClient * vatMul).toFixed(2), vatLabel],
          ["₪" + (g.totalClient * vatPlus).toFixed(2), vatTotalLabel],
        ]
      : isPercent
      ? [
          ["₪" + g.totalClient.toFixed(2), clientTotalLabel],
          ["₪" + (g.totalClient * vatMul).toFixed(2), vatLabel],
          ["₪" + (g.totalClient * vatPlus).toFixed(2), vatTotalLabel],
        ]
      : [["₪" + g.totalClient.toFixed(2), payTotalLabel]];

    // Centered summary table, no outer border, blue bold amounts
    const summaryW = 90;
    const summaryLeft = (pageW - summaryW) / 2;
    autoTable(doc, {
      body: summaryRows,
      startY: summaryStartY,
      margin: { left: summaryLeft, right: summaryLeft },
      tableWidth: summaryW,
      styles: { font: "Heebo", fontSize: 10, halign: "right", cellPadding: { top: 0.4, bottom: 0.4, left: 2, right: 2 }, lineWidth: 0 },
      columnStyles: {
        0: {
          fillColor: [255, 255, 255],
          cellWidth: 40,
          halign: "right",
          fontStyle: "bold",
          textColor: BLUE,
        },
        1: { fillColor: [255, 255, 255], fontStyle: "bold", cellWidth: 50, halign: "right" },
      },
      theme: "plain",
    });

    // @ts-expect-error — autoTable adds lastAutoTable
    let endY: number = doc.lastAutoTable?.finalY ?? summaryStartY + 20;
    endY = Math.max(endY, leftBottom + 2) + 4;

    // "פירוט נסיעות" heading
    doc.setFontSize(12);
    doc.setFont("Heebo", "bold");
    doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.text(reverseText("פירוט נסיעות"), pageW - margin, endY, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.setFont("Heebo", "normal");
    endY += 4;

    // autoTable lays out columns left→right by array index. Visual RTL order:
    // [מס׳ | תאריך | מסלול | שם מזמין | טלפון | (מחיר נהג) | מחיר ללקוח]
    // → array order is reversed: leftmost first.
    // Visual RTL order requested: טלפון | מחיר נהג | מחיר ללקוח | סה"כ כולל מע"מ
    // Array order (leftmost first) is reversed.
    const head: string[] = [];
    if (showFull) head.push(reverseText('סה"כ כולל מע"מ'));
    head.push(reverseText("מחיר ללקוח"));
    if (showDriver || showFull) head.push(reverseText("מחיר נהג"));
    head.push(
      reverseText("הערות"),
      reverseText("טלפון"),
      reverseText("שם מזמין"),
      reverseText("מסלול"),
      reverseText("תאריך"),
      reverseText("מס'"),
    );

    const body = g.trips.map((t) => {
      const cp = computeClientPrice(t.price, g.client);
      const row: string[] = [];
      if (showFull) row.push(cp != null ? "₪" + (Number(cp) * vatPlus).toFixed(2) : "");
      row.push(cp != null ? "₪" + Number(cp).toFixed(2) : "");
      if (showDriver || showFull) row.push(t.price != null ? "₪" + Number(t.price).toFixed(2) : "");
      const origin = (t.origin ?? "").trim();
      const destination = (t.destination ?? "").trim();
      const route = origin && destination
        ? reverseText(destination) + "  < " + reverseText(origin)
        : reverseText(origin || destination);
      row.push(
        reverseText(t.notes ?? ""),
        t.phone ?? "",
        reverseText(t.passenger_name ?? ""),
        route,
        formatDateHebrew(t.trip_date),
        t.trip_number ?? "",
      );
      return row;
    });

    // Client price column index (leftmost = 0).
    // showFull: [total-incl-vat, client, driver, ...] → client = 1
    // otherwise: [client, (driver), ...] → client = 0
    const clientPriceCol = showFull ? 1 : 0;

    autoTable(doc, {
      head: [head],
      body,
      startY: endY,
      margin: { left: margin, right: margin },
      styles: { font: "Heebo", fontSize: 9, halign: "right", cellPadding: 2.2, lineWidth: 0 },
      headStyles: {
        font: "Heebo",
        fontStyle: "bold",
        fillColor: BLUE,
        textColor: 255,
        halign: "right",
        cellPadding: 2.8,
      },
      alternateRowStyles: { fillColor: ROW_ALT },
      bodyStyles: { fillColor: ROW_LIGHT },
      columnStyles: {
        [clientPriceCol]: { textColor: BLUE, fontStyle: "bold" },
      },
      theme: "plain",
    });

    // @ts-expect-error — autoTable adds lastAutoTable
    endY = doc.lastAutoTable?.finalY ?? endY + 30;
    endY += 8;

    if (settings.global_note && settings.global_note.trim()) {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      const lines = doc.splitTextToSize(reverseText(settings.global_note), pageW - margin * 2);
      doc.text(lines, pageW - margin, endY, { align: "right" });
      doc.setTextColor(0, 0, 0);
    }

    const safeName = g.client.name.replace(/[\\/:*?"<>|]/g, "_");
    const fileName = `${safeName}_${monthLabel}.pdf`;
    if (zip) {
      zip.file(fileName, doc.output("blob"));
    } else {
      doc.save(fileName);
    }
  };

  const handleGenerateAll = async () => {
    if (!groups.length) {
      toast.error("אין לקוחות לייצוא בחודש זה");
      return;
    }
    const monthLabel = formatBillingMonthLabel(selectedMonth);
    setProgress({ current: 0, total: groups.length, name: "" });
    let success = 0;
    const zip = new JSZip();
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      setProgress({ current: i + 1, total: groups.length, name: g.client.name });
      try {
        await generatePdfForGroup(g, monthLabel, zip);
        success++;
      } catch (e) {
        console.error("PDF failed for", g.client.name, e);
      }
    }
    if (success > 0) {
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `דוחות ${monthLabel} כביש 1.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setProgress(null);
    toast.success(`הופקו ${success} קבצים בהצלחה`);
  };

  const handleGenerateOne = async (g: ClientGroup) => {
    const monthLabel = formatBillingMonthLabel(selectedMonth);
    try {
      await generatePdfForGroup(g, monthLabel);
      toast.success(`הופק PDF ל-${g.client.name}`);
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בהפקת PDF");
    }
  };

  const generateExcelForGroup = (g: ClientGroup, monthLabel: string): void => {
    const showDriver = !!g.client.show_driver_price;
    const showFull = !!g.client.show_full_price_breakdown;
    const isPercent = g.client.markup_type === "percent";
    const noVat = !!g.client.markup_includes_vat;
    const vatMul = noVat ? 0 : vatRate / 100;
    const vatPlus = noVat ? 1 : 1 + vatMul;

    const header: string[] = ["מס' נסיעה", "תאריך", "מוצא", "יעד", "שם מזמין", "טלפון"];
    if (showDriver) header.push("מחיר נהג");
    header.push("מחיר ללקוח");

    const rows: (string | number)[][] = g.trips.map((t) => {
      const cp = computeClientPrice(t.price, g.client);
      const row: (string | number)[] = [
        t.trip_number ?? "",
        formatDateHebrew(t.trip_date),
        t.origin ?? "",
        t.destination ?? "",
        t.passenger_name ?? "",
        t.phone ?? "",
      ];
      if (showDriver) row.push(t.price != null ? Number(t.price) : "");
      row.push(cp != null ? Number(cp) : "");
      return row;
    });

    const summary: (string | number)[][] = [[]];
    if (showFull) {
      summary.push(["סה\"כ מחירון לנהג", g.totalDriver]);
      summary.push(["סה\"כ מחיר ללקוח", g.totalClient]);
      summary.push(["סה\"כ מע\"מ", g.totalClient * vatMul]);
      summary.push(["סה\"כ כולל מע\"מ", g.totalClient * vatPlus]);
    } else if (isPercent) {
      summary.push(["סה\"כ מחיר ללקוח", g.totalClient]);
      summary.push(["סה\"כ מע\"מ", g.totalClient * vatMul]);
      summary.push(["סה\"כ כולל מע\"מ", g.totalClient * vatPlus]);
    } else {
      summary.push(["סה\"כ לתשלום", g.totalClient]);
    }

    const titleRows: (string | number)[][] = [
      [settings.business_name || ""],
      [`דוח נסיעות: ${g.client.name}`],
      [monthLabel],
      [],
    ];

    const aoa: (string | number)[][] = [...titleRows, header, ...rows, ...summary];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = header.map(() => ({ wch: 16 }));
    if (!ws["!props"]) ws["!props"] = {};
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "דוח");
    const safeName = g.client.name.replace(/[\\/:*?"<>|]/g, "_");
    XLSX.writeFile(wb, `${safeName}_${monthLabel}.xlsx`);
  };

  const handleGenerateExcel = (g: ClientGroup) => {
    const monthLabel = formatBillingMonthLabel(selectedMonth);
    try {
      generateExcelForGroup(g, monthLabel);
      toast.success(`הופק אקסל ל-${g.client.name}`);
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בהפקת אקסל");
    }
  };

  const normalizePhoneForWa = (phone: string | null | undefined): string => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("972")) return digits;
    if (digits.startsWith("0")) return "972" + digits.slice(1);
    return digits;
  };

  const openExternalLink = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const buildClientMessage = (g: ClientGroup): string => {
    const monthLabel = formatBillingMonthLabel(selectedMonth);
    const isPercent = g.client.markup_type === "percent";
    const noVat = !!g.client.markup_includes_vat;
    const total = isPercent && !noVat ? g.totalClient * (1 + vatRate / 100) : g.totalClient;
    return renderTemplate(settings.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE, {
      clientName: g.client.name,
      month: monthLabel,
      amount: total.toLocaleString("he-IL", { maximumFractionDigits: 2 }),
    });
  };

  const handleSendWa = (g: ClientGroup) => {
    const phone = normalizePhoneForWa(g.client.phone);
    if (!phone) {
      toast.error("אין מספר טלפון ללקוח");
      return;
    }
    const url = `https://web.whatsapp.com/send/?phone=${phone}&text=${encodeURIComponent(buildClientMessage(g))}&type=phone_number&app_absent=0`;
    openExternalLink(url);
  };

  const handleSendEmail = (g: ClientGroup) => {
    if (!g.client.email) {
      toast.error("אין כתובת מייל ללקוח");
      return;
    }
    const subject = `דרישת תשלום — ${g.client.name}`;
    const body = buildClientMessage(g);
    const res = openGmailCompose({ to: g.client.email, subject, body });
    if (!res.ok && res.reason === "invalid") toast.error("כתובת מייל לא תקינה");
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      <header className="border-b border-border/60 bg-card shadow-[var(--shadow-card)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <FileDown className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">הפקת דוחות PDF</h1>
              <p className="text-xs text-muted-foreground">ייצוא דוחות חודשיים ללקוחות</p>
            </div>
          </div>
          <PageNav current="reports" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <section className="space-y-3 rounded-xl bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold text-foreground">הגדרות עסק</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="biz-name">שם העסק</Label>
              <Input
                id="biz-name"
                value={settings.business_name}
                onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="biz-phone">טלפון</Label>
              <Input
                id="biz-phone"
                dir="ltr"
                value={settings.business_phone}
                onChange={(e) => setSettings({ ...settings, business_phone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="biz-email">מייל</Label>
              <Input
                id="biz-email"
                dir="ltr"
                type="email"
                value={settings.business_email}
                onChange={(e) => setSettings({ ...settings, business_email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>לוגו חברה</Label>
            <div className="flex items-center gap-3">
              {settings.business_logo ? (
                <div className="relative">
                  <img
                    src={settings.business_logo}
                    alt="לוגו העסק"
                    className="h-16 w-auto rounded border border-border bg-white p-1"
                  />
                  <button
                    type="button"
                    aria-label="הסר לוגו"
                    onClick={() => setSettings({ ...settings, business_logo: "" })}
                    className="absolute -left-2 -top-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-32 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">
                  אין לוגו
                </div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>
                <Upload className="ml-2 h-4 w-4" />
                העלה לוגו
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="biz-note">הערה כללית לכל הדוחות</Label>
            <Textarea
              id="biz-note"
              rows={3}
              value={settings.global_note}
              onChange={(e) => setSettings({ ...settings, global_note: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa-template">תבנית הודעת חוב לוואטסאפ</Label>
            <Textarea
              id="wa-template"
              rows={3}
              value={settings.whatsapp_template}
              onChange={(e) => setSettings({ ...settings, whatsapp_template: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              משתנים זמינים: {"{שם_לקוח}"}, {"{חודש}"}, {"{סכום}"}
            </p>
          </div>
          <div>
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              <Save className="ml-2 h-4 w-4" />
              {savingSettings ? "שומר..." : "שמור הגדרות"}
            </Button>
          </div>
          <div className="border-t border-border/60 pt-4">
            <Label className="mb-2 block">ייבוא חד פעמי של חובות ישנים</Label>
            <ImportOldDebtsButton />
            <p className="mt-1 text-xs text-muted-foreground">
              מעלה קובץ דרישת תשלום ומייבא יתרות חוב פתוחות לחודשים קודמים.
            </p>
          </div>
        </section>

        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">בחירת חודש לייצוא</h2>
            {billing && (
              <span className="text-xs text-muted-foreground">
                חודש פעיל: {formatBillingMonthLabel(billing.month)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="חודש קודם"
              onClick={() => setSelectedMonth((m) => prevMonth(m))}
              disabled={!selectedMonth}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <div className="min-w-[160px] text-center text-lg font-bold text-foreground">
              {selectedMonth ? formatBillingMonthLabel(selectedMonth) : "—"}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="חודש הבא"
              onClick={() => setSelectedMonth((m) => nextMonth(m))}
              disabled={!selectedMonth}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
        </section>

        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              לקוחות בחודש זה ({groups.length})
            </h2>
            <Button onClick={handleGenerateAll} disabled={!groups.length || !!progress}>
              <FileDown className="ml-2 h-4 w-4" />
              הפק PDF לכולם
            </Button>
          </div>

          {progress && (
            <div className="mb-4 space-y-2 rounded-lg border border-border/60 bg-muted/40 p-3">
              <div className="text-sm text-foreground">
                מייצר {progress.name}... ({progress.current} מתוך {progress.total})
              </div>
              <Progress value={(progress.current / progress.total) * 100} />
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-muted-foreground">טוען...</div>
          ) : groups.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              אין נסיעות לחודש הנבחר
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {groups.map((g) => (
                <li key={g.client.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium text-foreground">{g.client.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {g.trips.length} נסיעות · סה״כ ללקוח: ₪{g.totalClient.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleGenerateOne(g)} disabled={!!progress}>
                      <FileDown className="ml-2 h-4 w-4" />
                      הפק PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleGenerateExcel(g)} disabled={!!progress}>
                      <FileSpreadsheet className="ml-2 h-4 w-4" />
                      הפק אקסל
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                      onClick={() => handleSendWa(g)}
                      aria-label="שלח וואטסאפ"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      onClick={() => handleSendEmail(g)}
                      aria-label="שלח מייל"
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}