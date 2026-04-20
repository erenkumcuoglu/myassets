import puppeteer, { Browser, Page } from "puppeteer";

// Cache to avoid repeated browser launches
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
    });
  }
  return browser;
}

export async function fetchTefasPriceWithPuppeteer(fundCode: string): Promise<number> {
  const code = fundCode.toUpperCase();
  const url = `https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${code}`;
  
  const pageBrowser = await getBrowser();
  const page = await pageBrowser.newPage();
  
  try {
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    
    // Set extra headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });
    
    // Navigate to the page
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    
    // Wait for the price element to be visible
    // The price is in the first <span> after "Son Fiyat (TL)"
    await page.waitForFunction(
      () => {
        const spans = document.querySelectorAll("span");
        for (let i = 0; i < spans.length; i++) {
          const text = spans[i].textContent || "";
          // Match Turkish number format: 5142,418363
          if (/^[0-9]+,[0-9]+$/.test(text) && parseFloat(text.replace(",", ".")) > 0) {
            return true;
          }
        }
        return false;
      },
      { timeout: 10000 }
    );
    
    // Extract the price
    const price = await page.evaluate(() => {
      // Look for the specific pattern: "Son Fiyat (TL)" followed by a number
      const allElements = document.querySelectorAll("*");
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        const text = el.textContent || "";
        if (text.includes("Son Fiyat (TL)")) {
          // Look for the next span with a number
          const spans = document.querySelectorAll("span");
          for (let j = 0; j < spans.length; j++) {
            const spanText = spans[j].textContent || "";
            const match = spanText.match(/^([0-9]+,[0-9]+)$/);
            if (match) {
              return parseFloat(match[1].replace(",", "."));
            }
          }
        }
      }
      
      // Fallback: search all spans for price pattern
      const spans = document.querySelectorAll("span");
      for (let i = 0; i < spans.length; i++) {
        const text = spans[i].textContent || "";
        const match = text.match(/^([0-9]+,[0-9]{2,})$/);
        if (match) {
          const value = parseFloat(match[1].replace(",", "."));
          if (value > 0 && value < 1000000) { // Reasonable fund price range
            return value;
          }
        }
      }
      
      return null;
    });
    
    if (!price || price <= 0) {
      throw new Error(`Could not extract price for ${code}`);
    }
    
    console.log(`[TEFAS-Puppeteer] Fetched price ${price} for ${code}`);
    return price;
    
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[TEFAS-Puppeteer] Error fetching ${code}:`, msg);
    throw new Error(`TEFAS Puppeteer: ${msg}`);
  } finally {
    await page.close();
  }
}

// Cleanup function to close browser
export async function closeTefasBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
