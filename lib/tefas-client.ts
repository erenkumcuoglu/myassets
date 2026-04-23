/**
 * tefas-client.ts
 *
 * Tarayıcıdan doğrudan tefas.gov.tr'ye istek atar.
 * SADECE client-side (use client) componentlerde çağrılmalı.
 * Railway/server-side'dan çağrılmaz — Türkiye dışı IP bloklanıyor.
 */

const TEFAS_API = "https://www.tefas.gov.tr/api/DB/BindHistoryInfo";

function toTefasDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export async function fetchTefasPriceFromBrowser(
  fundCode: string
): Promise<{ price: number; date: string } | null> {
  // TEFAS bazen bugünün fiyatını akşama kadar yayınlamaz, 5 güne kadar geriye git
  for (let daysBack = 1; daysBack <= 5; daysBack++) {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    // Hafta sonu atla
    if (d.getDay() === 0) { d.setDate(d.getDate() - 2); }
    if (d.getDay() === 6) { d.setDate(d.getDate() - 1); }
    const dateStr = toTefasDate(d);

    try {
      const body = new URLSearchParams({
        fontip: "YAT",
        fonkod: fundCode,
        bastarih: dateStr,
        bittarih: dateStr,
      });

      const res = await fetch(TEFAS_API, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!res.ok) continue;

      const text = await res.text();
      if (text.trim().startsWith("<")) continue; // HTML = blok

      const json = JSON.parse(text);
      const record = json?.data?.[0];
      if (!record || !record.FIYAT) continue;

      // TEFAS FIYAT can be string with comma as decimal separator
      const rawPrice = record.FIYAT;
      const price = typeof rawPrice === "string" 
        ? Number(rawPrice.replace(",", ".")) 
        : Number(rawPrice);

      if (Number.isNaN(price) || price <= 0) continue;

      return { price, date: dateStr };
    } catch {
      continue;
    }
  }
  return null;
}
