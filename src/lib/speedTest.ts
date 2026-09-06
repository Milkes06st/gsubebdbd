export interface NetworkInfo {
  ip: string;
  isp: string;
  country: string;
  city: string;
}

export async function fetchNetworkInfo(): Promise<NetworkInfo | null> {
  try {
    const response = await fetch("https://ipinfo.io/json", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch proxy IP info");
    const data = await response.json();
    
    // ipinfo.io 'org' field often starts with the ASN like "AS12345 Company Name"
    let ispName = data.org || "Unknown ISP";
    if (ispName.startsWith("AS") && ispName.includes(" ")) {
      ispName = ispName.split(" ").slice(1).join(" ");
    }
    
    return {
      ip: data.ip,
      isp: ispName,
      country: data.country || "Unknown Country",
      city: data.city || "Unknown City",
    };
  } catch (err) {
    console.error("Failed to fetch network info", err);
    return null;
  }
}

export async function measurePing(): Promise<number> {
  const samples = 6;
  const pings: number[] = [];
  const endpoint = "https://speed.cloudflare.com/__down?bytes=0";

  // Warmup request to establish TCP/TLS connection and DNS cache
  try {
    await fetch(`${endpoint}&t=warmup`, { cache: "no-store" });
  } catch (e) {}

  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      await fetch(`${endpoint}&t=${performance.now()}`, { 
        cache: "no-store", 
        signal: controller.signal,
        mode: "cors"
      });
      clearTimeout(timeoutId);
      const end = performance.now();
      pings.push(end - start);
    } catch {
      // Ignore failed pings
    }
  }

  if (pings.length === 0) return 0;
  
  pings.sort((a, b) => a - b);
  const bestPing = Math.round(pings[0]);
  return Math.max(1, bestPing - 2);
}

export async function measureDownloadSpeed(
  onProgress: (mbps: number, progress: number) => void
): Promise<number> {
  const maxDurationMs = 10000;
  const chunkSizeBytes = 25 * 1024 * 1024; // 25 MB chunks
  
  const startTime = performance.now();
  let totalDownloadedBytes = 0;
  let keepDownloading = true;
  let lastReportedMbps = 0;

  const timeoutId = setTimeout(() => {
    keepDownloading = false;
  }, maxDurationMs);

  while (keepDownloading && (performance.now() - startTime) < maxDurationMs) {
    const controller = new AbortController();
    const timeRemaining = maxDurationMs - (performance.now() - startTime);
    const innerTimeout = setTimeout(() => controller.abort(), Math.max(timeRemaining, 10));
    
    try {
      const response = await fetch(`https://speed.cloudflare.com/__down?bytes=${chunkSizeBytes}&t=${Date.now()}`, { 
        cache: "no-store", 
        signal: controller.signal,
        mode: "cors"
      });
      
      if (!response.body) throw new Error("ReadableStream not supported.");

      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalDownloadedBytes += value.length;
        const elapsedMs = performance.now() - startTime;

        if (elapsedMs > 0 && elapsedMs <= maxDurationMs) {
          const bytesPerSecond = totalDownloadedBytes / (elapsedMs / 1000);
          const mbps = (bytesPerSecond * 8) / (1024 * 1024);
          lastReportedMbps = mbps;
          onProgress(mbps, Math.min(elapsedMs / maxDurationMs, 1));
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && !err.message?.toLowerCase().includes('input stream')) {
        console.warn("Download chunk note:", err.message);
      }
      await new Promise(r => setTimeout(r, 200));
    } finally {
      clearTimeout(innerTimeout);
    }
  }

  clearTimeout(timeoutId);
  return lastReportedMbps;
}

export async function measureUploadSpeed(
  onProgress: (mbps: number, progress: number) => void
): Promise<number> {
  const maxDurationMs = 10000;
  const chunkSize = 2 * 1024 * 1024; // 2 MB chunks
  const dummyData = new Uint8Array(chunkSize);
  
  for (let i = 0; i < dummyData.length; i += 1024 * 64) {
    dummyData[i] = Math.floor(Math.random() * 256);
  }

  const startTime = performance.now();
  let totalUploadedBytes = 0;
  let keepUploading = true;
  let currentXhr: XMLHttpRequest | null = null;
  let lastReportedMbps = 0;

  const timeoutId = setTimeout(() => {
    keepUploading = false;
    if (currentXhr) currentXhr.abort();
  }, maxDurationMs);

  while (keepUploading && (performance.now() - startTime) < maxDurationMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        currentXhr = xhr;
        xhr.open("POST", `https://speed.cloudflare.com/__up?t=${Date.now()}`, true);
        
        xhr.upload.onprogress = (event) => {
          const currentTime = performance.now();
          const elapsedMs = currentTime - startTime;
          const currentTotal = totalUploadedBytes + event.loaded;
          if (elapsedMs > 0 && elapsedMs <= maxDurationMs) {
            const bytesPerSecond = currentTotal / (elapsedMs / 1000);
            const mbps = (bytesPerSecond * 8) / (1024 * 1024);
            lastReportedMbps = mbps;
            onProgress(mbps, Math.min(elapsedMs / maxDurationMs, 1));
          }
        };
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            totalUploadedBytes += chunkSize;
            resolve();
          } else {
            reject(new Error("Upload failed"));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error"));
        };
        
        xhr.onabort = () => {
          resolve();
        };

        xhr.send(dummyData);
      });
    } catch (err) {
      console.error("Upload chunk sequence failed", err);
      break;
    }
  }
  
  clearTimeout(timeoutId);
  return lastReportedMbps;
}
