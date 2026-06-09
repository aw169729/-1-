// Opens Gmail compose directly in the browser.
export function openGmail(email: string, subject: string, body: string) {
  const to = email.toLowerCase().trim();
  const su = encodeURIComponent(subject);
  const bd = encodeURIComponent(body);
  const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}&body=${bd}`;
  window.open(url, "_blank");
}

// Backwards-compatible wrapper used by existing call sites.
export function openGmailCompose(opts: {
  to: string;
  subject: string;
  body: string;
}): { ok: true } | { ok: false; reason: "missing" | "invalid" } {
  const raw = (opts.to || "").trim().toLowerCase();
  if (!raw) return { ok: false, reason: "missing" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return { ok: false, reason: "invalid" };
  openGmail(raw, opts.subject, opts.body);
  return { ok: true };
}