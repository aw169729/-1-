import { jsPDF } from "jspdf";

// Hebrew font (Heebo Regular) loaded once and cached as base64.
let cachedFontBase64: string | null = null;
let cachedFontPromise: Promise<string> | null = null;

const FONT_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/heebo@5.0.20/files/heebo-hebrew-400-normal.woff";
const FONT_TTF_URL =
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/heebo/Heebo%5Bwght%5D.ttf";

async function fetchFontBase64(): Promise<string> {
  // jsPDF needs TTF, not WOFF. Use the TTF from google/fonts repo.
  const res = await fetch(FONT_TTF_URL);
  if (!res.ok) throw new Error("failed to load hebrew font");
  const buf = await res.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}

export async function ensureHebrewFont(doc: jsPDF): Promise<void> {
  if (!cachedFontBase64) {
    if (!cachedFontPromise) cachedFontPromise = fetchFontBase64();
    cachedFontBase64 = await cachedFontPromise;
  }
  doc.addFileToVFS("Heebo.ttf", cachedFontBase64);
  doc.addFont("Heebo.ttf", "Heebo", "normal");
  doc.addFont("Heebo.ttf", "Heebo", "bold");
  doc.setFont("Heebo", "normal");
  // Use suppressed marker — we render RTL by passing align:"right" + isInputRtl:true.
}

// Suppress unused FONT_URL warning while keeping reference for documentation.
void FONT_URL;