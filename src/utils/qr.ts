// src/utils/qr.ts
const QR_PREFIX = "temp-monitor://chiller/";

export function buildChillerQrValue(chillerId: string) {
  // Keep it simple + stable
  return `${QR_PREFIX}${encodeURIComponent(chillerId)}`;
}

export function parseChillerIdFromQr(value: string): string | null {
  const s = String(value || "").trim();

  // Accept deep link format
  if (s.startsWith(QR_PREFIX)) {
    const id = s.slice(QR_PREFIX.length);
    return decodeURIComponent(id || "").trim() || null;
  }

  // Accept raw id as fallback (optional)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;

  return null;
}