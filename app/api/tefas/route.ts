import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEFAS_URL = "https://www.tefas.gov.tr/api/DB/BindHistoryInfo";

type TefasRow = {
  FIYAT?: number | string;
  FONKODU?: string;
};

type TefasResponse = {
  data?: TefasRow[];
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fonkod } = body;

    if (!fonkod) {
      return NextResponse.json({ error: "Missing fonkod parameter" }, { status: 400 });
    }

    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();
    const todayStr = `${day}.${month}.${year}`;

    const response = await fetch(TEFAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fontip: "YAT",
        bastarih: todayStr,
        bittarih: todayStr,
        fonkod: fonkod.toUpperCase(),
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "TEFAS API request failed" }, { status: response.status });
    }

    const payload = (await response.json()) as TefasResponse;
    const rawPrice = payload.data?.[0]?.FIYAT;
    const numericPrice =
      typeof rawPrice === "string" ? Number(rawPrice.replace(",", ".")) : rawPrice;

    if (typeof numericPrice !== "number" || Number.isNaN(numericPrice)) {
      return NextResponse.json({ error: "No valid price found" }, { status: 404 });
    }

    return NextResponse.json({ price: numericPrice });
  } catch (error) {
    console.error("TEFAS API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
