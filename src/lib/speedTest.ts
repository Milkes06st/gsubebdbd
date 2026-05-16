export interface NetworkInfo {
  ip: string;
  isp: string;
  country: string;
  city: string;
}

export async function fetchNetworkInfo(): Promise<NetworkInfo | null> {
  try {
    const response = await fetch("https://ipwho.is/");
    if (!response.ok) return null;
    const data = await response.json();
    return {
      ip: data.ip,
      isp: data.connection?.isp || "Unknown ISP",
      country: data.country,
      city: data.city,
    };
  } catch (err) {
    console.error("Failed to fetch network info", err);
    return null;
  }
}

export async function measurePing(): Promise<number> {
  const samples = 10;
  let totalTime = 0;
  let successfulPings = 0;

  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    try {
      await fetch(`/api/ping?t=${Date.now()}`, { cache: "no-store" });
      const end = performance.now();
      totalTime += end - start;
      successfulPings++;
    } catch {
      // Ignore failed pings
    }
    // minimal sleep
    await new Promise(r => setTimeout(r, 50));
  }

  if (successfulPings === 0) return 0;
  return Math.round(totalTime / successfulPings);
}

export async function measureDownloadSpeed(
  onProgress: (mbps: number, progress: number) => void
): Promise<number> {
  const maxDurationMs = 10000;
  const chunkSizeBytes = 25 * 1024 * 1024; // 25 MB chunks to bypass proxy size limits
  
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
      const response = await fetch(`/api/download?size=${chunkSizeBytes}&t=${Date.now()}`, { 
        cache: "no-store", 
        signal: controller.signal 
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
      // Small delay to prevent tight loop on failure
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
  const chunkSize = 2 * 1024 * 1024; // 2 MB chunks (avoids 32MB limits)
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
        xhr.open("POST", `/api/upload?t=${Date.now()}`, true);
        
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
          resolve(); // Abort is intentional on timeout
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
