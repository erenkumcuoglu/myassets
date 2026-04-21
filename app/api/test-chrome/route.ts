export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    env: {
      PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD,
      PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
      CHROME_BIN: process.env.CHROME_BIN,
    },
  };

  try {
    const puppeteer = await import("puppeteer");
    
    const launchStart = Date.now();
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
    });
    
    results.launchTimeMs = Date.now() - launchStart;
    results.browserLaunched = true;
    
    const page = await browser.newPage();
    await page.goto("https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=TLY", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    
    const title = await page.title();
    const url = page.url();
    
    results.pageTest = {
      title: title,
      url: url,
      success: title.includes("TEFAS") || url.includes("tefas.gov.tr"),
    };
    
    await browser.close();
    results.browserClosed = true;
    results.status = "success";
    
  } catch (error) {
    results.status = "error";
    results.error = error instanceof Error ? error.message : String(error);
    results.stack = error instanceof Error ? error.stack : undefined;
  }

  return NextResponse.json(results);
}
