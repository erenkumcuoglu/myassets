// Cloudflare Worker - Debug versiyon
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const fundCode = url.searchParams.get("code");
    
    // Debug bilgileri
    const clientIP = request.headers.get("CF-Connecting-IP");
    const userAgent = request.headers.get("User-Agent");
    
    console.log(`[DEBUG] Request from IP: ${clientIP}`);
    console.log(`[DEBUG] User-Agent: ${userAgent}`);
    console.log(`[DEBUG] Fund code: ${fundCode}`);

    if (!fundCode) {
      return Response.json({ error: "code parameter required" }, { status: 400 });
    }

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const dateStr = `${dd}.${mm}.${yyyy}`;

    // JSON body hazırla (URLSearchParams değil!)
    const requestBody = {
      fontip: "YAT",
      bastarih: dateStr,
      bittarih: dateStr,
      fonkod: fundCode.toUpperCase(),
    };

    try {
      console.log(`[DEBUG] Sending to TEFAS: ${JSON.stringify(requestBody)}`);
      
      const res = await fetch("https://www.tefas.gov.tr/api/DB/BindHistoryInfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": `https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${fundCode.toUpperCase()}`,
          "Origin": "https://www.tefas.gov.tr",
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`[DEBUG] TEFAS response status: ${res.status}`);
      
      const text = await res.text();
      console.log(`[DEBUG] TEFAS response length: ${text.length}`);
      console.log(`[DEBUG] TEFAS response preview: ${text.substring(0, 200)}`);

      if (text.trim().startsWith("<")) {
        return Response.json({ 
          error: "TEFAS returned HTML", 
          preview: text.substring(0, 500),
          ip: clientIP 
        }, { status: 502 });
      }

      const data = JSON.parse(text);
      const price = data?.data?.[0]?.FIYAT;

      if (!price) {
        return Response.json({ 
          error: "No price found", 
          raw: data,
          ip: clientIP 
        }, { status: 404 });
      }

      return Response.json({
        code: fundCode.toUpperCase(),
        price: parseFloat(price),
        date: dateStr,
        debug: { ip: clientIP }
      });

    } catch (err) {
      console.error(`[DEBUG] Error: ${err}`);
      return Response.json({ 
        error: String(err),
        ip: clientIP,
        stack: err.stack 
      }, { status: 500 });
    }
  }
};
