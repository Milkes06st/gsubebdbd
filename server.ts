import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { randomBytes } from "crypto";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Disable cache for speed test endpoints
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // API constraints for high-throughput body
  app.use(express.raw({ type: '*/*', limit: '100mb' }));

  // --- Speed Test Endpoints ---

  // Ping endpoint
  app.get("/api/ping", (req, res) => {
    // Send 1 byte to make response smaller
    res.status(200).send("1");
  });

  // Download endpoint - streams random data
  app.get("/api/download", (req, res) => {
    const sizeParam = parseInt(req.query.size as string, 10);
    // Max 1000MB per request, default 20MB
    const targetSize = !isNaN(sizeParam) && sizeParam > 0 ? Math.min(sizeParam, 1000 * 1024 * 1024) : 20 * 1024 * 1024; 
    
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", targetSize.toString());

    // Send chunks to avoid massive memory allocation
    const chunkSize = 1024 * 1024; // 1MB chunks
    let sent = 0;
    const chunk = randomBytes(chunkSize);
    let isCancelled = false;

    req.on('close', () => {
      isCancelled = true;
    });

    req.on('error', () => {
      isCancelled = true;
    });

    function sendChunk() {
      if (isCancelled) return;
      if (sent >= targetSize) {
        res.end();
        return;
      }
      const toSend = Math.min(chunkSize, targetSize - sent);
      
      let ok: boolean;
      try {
        ok = res.write(toSend === chunkSize ? chunk : chunk.subarray(0, toSend));
      } catch (err) {
        isCancelled = true;
        return;
      }

      sent += toSend;
      if (ok) {
        setImmediate(sendChunk);
      } else {
        res.once('drain', sendChunk);
      }
    }

    sendChunk();
  });

  // Upload endpoint - discards received data
  app.post("/api/upload", (req, res) => {
    res.status(200).json({ received: req.body ? req.body.length : 0 });
  });

  // Telegram notification proxy
  let cachedChatId = process.env.TELEGRAM_CHAT_ID;
  
  app.post("/api/telegram", express.json(), async (req, res) => {
    try {
      // Decode obscured bot token
      const token = process.env.TELEGRAM_BOT_TOKEN || Buffer.from("ODYyMTY5NzcxMTpBQUdzM0ZuM1hpQW1oWjc0NWtGT2tIYlhCa3FxY2Y1T3hkbw==", "base64").toString();

      let targetChatId = cachedChatId;
      
      // Auto-detect chat ID from recent bot messages if none configured
      if (!targetChatId) {
        try {
          const updatesReq = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
          const updates = await updatesReq.json();
          if (updates.ok && updates.result.length > 0) {
            const lastMsg = updates.result[updates.result.length - 1];
            targetChatId = lastMsg.message?.chat?.id || lastMsg.my_chat_member?.chat?.id || lastMsg.edited_message?.chat?.id;
            if (targetChatId) {
              cachedChatId = targetChatId; // remember it for future requests
            }
          }
        } catch(e) {}
      }

      const { download, upload, ping, city, country, isp, ip } = req.body;
      
      const escapeHtml = (str: any) => String(str || 'Unknown').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      const text = `📊 <b>Новый замер скорости</b>
      
🌍 <b>Локация:</b> ${escapeHtml(city)}, ${escapeHtml(country)}
🏢 <b>ISP:</b> ${escapeHtml(isp)}
🌐 <b>IP:</b> <tg-spoiler>${escapeHtml(ip)}</tg-spoiler>

📥 <b>Скачивание:</b> ${escapeHtml(download)} Мбит/с
📤 <b>Выгрузка:</b> ${escapeHtml(upload)} Мбит/с
⏱ <b>Пинг:</b> ${escapeHtml(ping)} мс
`;

      const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
      
      if (targetChatId) {
        fetch(tgUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: targetChatId,
                text: text,
                parse_mode: "HTML"
            })
        });
      }

      res.status(200).send("OK");
    } catch(err) {
      res.status(500).send("Error");
    }
  });

  // Proxy IP Info to prevent adblock/cors issues
  app.get("/api/ip", async (req, res) => {
    try {
      let clientIp = req.query.ip as string;
      if (!clientIp) {
        clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || "").toString().split(',')[0].trim();
      }
      
      // If clientIp is a private docker IP like 172.x.x.x or 192.168.x.x or ::ffff:172.x, strip it so the server fetches its own IP rather than failing
      const isPrivate = /^(::f{4}:)?(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|::1)/.test(clientIp);
      const ipParam = (clientIp && !isPrivate) ? clientIp : "";
      
      let ipInfo: any = null;

      // Try 1: ipwho.is
      if (!ipInfo) {
        try {
          const r1 = await fetch(`https://ipwho.is/${ipParam}`);
          if (r1.ok) {
              const d1 = await r1.json();
              if (d1.success) {
                  ipInfo = {
                     ip: d1.ip,
                     isp: d1.connection?.isp || "Unknown ISP",
                     country: d1.country,
                     country_code: d1.country_code,
                     city: d1.city
                  };
              }
          }
        } catch (e) {}
      }

      // Try 2: geojs.io
      if (!ipInfo) {
        try {
          const r2 = await fetch(`https://get.geojs.io/v1/ip/geo/${ipParam}.json`);
          if (r2.ok) {
              const d2 = await r2.json();
              ipInfo = {
                 ip: d2.ip,
                 isp: d2.organization_name || "Unknown ISP",
                 country: d2.country,
                 country_code: d2.country_code,
                 city: d2.city
              };
          }
        } catch(e) {}
      }

      // Try 3: ip-api.com
      if (!ipInfo) {
        try {
          const r3 = await fetch(`http://ip-api.com/json/${ipParam}`);
          if (r3.ok) {
             const d3 = await r3.json();
             if (d3.status === "success") {
                 ipInfo = {
                   ip: d3.query,
                   isp: d3.isp || d3.org,
                   country: d3.country,
                   country_code: d3.countryCode,
                   city: d3.city
                 };
             }
          }
        } catch(e) {}
      }

      if (!ipInfo) throw new Error("All APIs failed");

      if (ipInfo.country_code) {
         try {
           const code = ipInfo.country_code.toUpperCase();
           const flag = String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
           ipInfo.country = `${ipInfo.country} ${flag}`;
         } catch(e) {}
      }

      res.json(ipInfo);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch IP info" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
