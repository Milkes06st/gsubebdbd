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
      
      const escapeMd = (str: string) => str.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
      
      const text = `📊 *Новый замер скорости*
      
🌍 *Локация:* ${escapeMd(city || 'Unknown')}, ${escapeMd(country || 'Unknown')}
🏢 *ISP:* ${escapeMd(isp || 'Unknown')}
🌐 *IP:* ||${escapeMd(ip || 'Unknown')}||

📥 *Скачивание:* ${escapeMd(download?.toString() || '0')} Мбит/с
📤 *Выгрузка:* ${escapeMd(upload?.toString() || '0')} Мбит/с
⏱ *Пинг:* ${escapeMd(ping?.toString() || '0')} мс
`;

      const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
      
      if (targetChatId) {
        fetch(tgUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: targetChatId,
                text: text,
                parse_mode: "MarkdownV2"
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
      const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || "").toString().split(',')[0].trim();
      const ipParam = clientIp && clientIp !== "::1" && clientIp !== "127.0.0.1" ? `${clientIp}/` : "";
      
      const response = await fetch(`https://ipwho.is/${ipParam}`);
      if (!response.ok) throw new Error("Fetch failed");
      const data = await response.json();
      
      const ipInfo = {
         ip: data.ip,
         isp: data.connection?.isp || "Unknown ISP",
         country: data.country,
         country_code: data.country_code,
         city: data.city,
      };

      if (ipInfo.country_code) {
         try {
           const code = ipInfo.country_code.toUpperCase();
           const flag = String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
           ipInfo.country = `${ipInfo.country} ${flag}`;
         } catch(e) {}
      }

      res.json(ipInfo);
    } catch (err) {
      try {
        const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || "").toString().split(',')[0].trim();
        const ipParam = clientIp && clientIp !== "::1" && clientIp !== "127.0.0.1" ? `${clientIp}/` : "";
        const fallback = await fetch(`https://ipinfo.io/${ipParam}json`);
        const fallbackData = await fallback.json();
        
     const ipInfo = {
         ip: fallbackData.ip,
         isp: fallbackData.org || "Unknown ISP",
         country: fallbackData.country,
         country_code: fallbackData.country,
         city: fallbackData.city,
        };

        if (ipInfo.country_code) {
         try {
           const code = ipInfo.country_code.toUpperCase();
           const flag = String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
           ipInfo.country = `${ipInfo.country} ${flag}`;
         } catch(e) {}
        }
        
        res.json(ipInfo);
      } catch (err2) {
        res.status(500).json({ error: "Failed to fetch IP info" });
      }
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
