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
    res.status(200).send("pong");
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

  // Proxy IP Info to prevent adblock/cors issues
  app.get("/api/ip", async (req, res) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || "").toString().split(',')[0].trim();
      const ipParam = clientIp && clientIp !== "::1" && clientIp !== "127.0.0.1" ? clientIp : "";
      
      const response = await fetch(`https://ipwho.is/${ipParam}`);
      if (!response.ok) throw new Error("Fetch failed");
      const data = await response.json();
      res.json(data);
    } catch (err) {
      try {
        const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || "").toString().split(',')[0].trim();
        const ipParam = clientIp && clientIp !== "::1" && clientIp !== "127.0.0.1" ? `${clientIp}/` : "";
        const fallback = await fetch(`https://ipinfo.io/${ipParam}json`);
        const fallbackData = await fallback.json();
        res.json(fallbackData);
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
