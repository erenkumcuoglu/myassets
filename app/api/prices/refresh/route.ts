export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { refreshPriceCache } from "@/lib/prices";
import { initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  try {
    await initDb();
    await refreshPriceCache();
    revalidatePath("/dashboard");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to refresh prices.",
      },
      { status: 500 },
    );
  }
}
