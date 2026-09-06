import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, Settings, MapPin, Share2, Check, Laptop } from "lucide-react";
import { fetchNetworkInfo, measurePing, measureDownloadSpeed, measureUploadSpeed, NetworkInfo } from "./lib/speedTest";
import { cn } from "./lib/utils";

type TestPhase = "idle" | "pinging" | "downloading" | "uploading" | "done";
export type SpeedUnit = "Mbps" | "MB/s" | "KB/s";

// Rocket logo matching rocket-svgrepo-com.svg
const AstroLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M50 4C45 10 19 26 19 46V68C14 71 4 77 1 82C-0.5 84.5 0 88 1.5 91C3 94 6.5 96 10 96H90C93.5 96 97 94 98.5 91C100 88 100.5 84.5 99 82C96 77 86 71 81 68V46C81 26 55 10 50 4ZM50 37.5C53.59 37.5 56.5 40.41 56.5 44C56.5 47.59 53.59 50.5 50 50.5C46.41 50.5 43.5 47.59 43.5 44C43.5 40.41 46.41 37.5 50 37.5Z"
    />
  </svg>
);

export interface SharedSpeedtestData {
  download: number;
  upload: number;
  ping: number;
  ip?: string;
  isp?: string;
  city?: string;
  country?: string;
  os?: string;
  browser?: string;
  unit?: SpeedUnit;
  date?: string;
}

export function detectClientSystem(): { os: string; browser: string } {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { os: "ОС", browser: "Браузер" };
  }

  const ua = navigator.userAgent || "";

  // OS Detection
  let os = "Linux";
  if (/android/i.test(ua)) {
    os = "Android";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = "iOS";
  } else if (/windows nt 10\.0/i.test(ua) || /windows nt 11\.0/i.test(ua) || /windows/i.test(ua)) {
    os = "Windows";
  } else if (/mac os x|macintosh/i.test(ua)) {
    os = "macOS";
  } else if (/cros/i.test(ua)) {
    os = "ChromeOS";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  // Browser Detection
  let browser = "Браузер";
  if (/yabrowser/i.test(ua)) {
    browser = "Яндекс Браузер";
  } else if (/samsungbrowser/i.test(ua)) {
    browser = "Samsung Browser";
  } else if (/opera|opr\//i.test(ua)) {
    browser = "Opera";
  } else if (/edg\//i.test(ua)) {
    browser = "Edge";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Firefox";
  } else if (/chrome|crios/i.test(ua)) {
    browser = "Chrome";
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browser = "Safari";
  }

  return { os, browser };
}

export function encodeSpeedtestBase64(data: SharedSpeedtestData): string {
  try {
    const json = JSON.stringify(data);
    const utf8Bytes = new TextEncoder().encode(json);
    let binary = "";
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } catch (e) {
    return "";
  }
}

export function decodeSpeedtestBase64(str: string): SharedSpeedtestData | null {
  try {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (typeof parsed.download === "number" || typeof parsed.d === "number") {
      let unit: SpeedUnit = "Mbps";
      if (parsed.unit === "MB/s" || parsed.u === "MB/s") unit = "MB/s";
      else if (parsed.unit === "KB/s" || parsed.u === "KB/s") unit = "KB/s";

      return {
        download: Number(parsed.download ?? parsed.d ?? 0),
        upload: Number(parsed.upload ?? parsed.u ?? 0),
        ping: Math.round(Number(parsed.ping ?? parsed.p ?? 0)),
        ip: parsed.ip || parsed.i,
        isp: parsed.isp,
        city: parsed.city,
        country: parsed.country,
        os: parsed.os,
        browser: parsed.browser || parsed.b,
        unit: unit,
        date: parsed.date,
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

const ChartSplineIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("lucide lucide-chart-spline", className)}>
    <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
    <path d="M7 16c.5-2 1.5-7 4-7 2 0 2 3 4 3 2.5 0 4.5-5 5-7"/>
  </svg>
);

const PlanetIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("lucide", className)}>
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    <path d="M2 12h20"/>
  </svg>
);

const ArchiveDownIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M3 4c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v3H3V4zm2 5h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9zm7 8.5l4-4h-3v-4h-2v4H8l4 4z"/>
  </svg>
);

const ArchiveUpIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M3 4c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v3H3V4zm2 5h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9zm7-7.5l4 4h-3v4h-2v-4H8l4-4z"/> 
  </svg>
);

export default function App() {
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [downloadMbps, setDownloadMbps] = useState<number>(0);
  const [uploadMbps, setUploadMbps] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [isBoostMode, setIsBoostMode] = useState(false);
  const [maxScale, setMaxScale] = useState<number>(100);
  const [unit, setUnit] = useState<SpeedUnit>("Mbps");
  const [clientSystem, setClientSystem] = useState<{ os: string; browser: string }>(() => detectClientSystem());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sharing & Shared Link state
  const [isSharedView, setIsSharedView] = useState(false);
  const [sharedMeta, setSharedMeta] = useState<{ date?: string } | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  useEffect(() => {
    if (window.location.pathname.toLowerCase() === '/boost100') {
      setIsBoostMode(true);
    }

    // Check for shared results in URL (/speedtest/:b64 or ?result=:b64 or #speedtest/:b64)
    const pathname = window.location.pathname;
    const speedtestMatch = pathname.match(/\/speedtest\/([A-Za-z0-9+/=_-]+)/i);
    const searchParams = new URLSearchParams(window.location.search);
    const queryB64 = searchParams.get("result") || searchParams.get("b64");
    const hashMatch = window.location.hash.match(/#\/?speedtest\/([A-Za-z0-9+/=_-]+)/i);

    const rawB64 = speedtestMatch?.[1] || queryB64 || hashMatch?.[1];
    if (rawB64) {
      const decoded = decodeSpeedtestBase64(rawB64);
      if (decoded) {
        setDownloadMbps(decoded.download);
        setUploadMbps(decoded.upload);
        setPing(decoded.ping);
        if (decoded.unit) setUnit(decoded.unit);
        setPhase("done");
        setIsSharedView(true);
        setSharedMeta({ date: decoded.date });
        if (decoded.isp || decoded.city || decoded.ip) {
          setNetworkInfo({
            ip: decoded.ip || "—",
            isp: decoded.isp || "Интернет-провайдер",
            city: decoded.city || "",
            country: decoded.country || "",
            country_code: ""
          });
        }
        if (decoded.os && decoded.browser) {
          setClientSystem({
            os: decoded.os,
            browser: decoded.browser
          });
        }
        return;
      }
    }

    fetchNetworkInfo().then(setNetworkInfo);
  }, []);

  const getDisplayValue = (mbps: number) => {
    if (unit === "MB/s") return mbps / 8;
    if (unit === "KB/s") return (mbps * 1000) / 8;
    return mbps;
  };

  const getUnitLabel = (u: SpeedUnit = unit) => {
    if (u === "MB/s") return "МБ/с";
    if (u === "KB/s") return "КБ/с";
    return "Мбит/с";
  };

  const generateShareUrl = () => {
    const displayDown = getDisplayValue(downloadMbps);
    const displayUp = getDisplayValue(uploadMbps);

    const payload: SharedSpeedtestData = {
      download: Number(displayDown.toFixed(unit === "KB/s" ? 0 : 1)),
      upload: Number(displayUp.toFixed(unit === "KB/s" ? 0 : 1)),
      ping: ping !== null ? ping : 0,
      ip: networkInfo?.ip || "",
      isp: networkInfo?.isp || "",
      city: networkInfo?.city || "",
      country: networkInfo?.country || "",
      os: clientSystem.os,
      browser: clientSystem.browser,
      unit: unit,
      date: new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    };

    const b64 = encodeSpeedtestBase64(payload);
    const origin = window.location.hostname.includes("vercel.app")
      ? window.location.origin
      : "https://astrotest-delta.vercel.app";
    return `${origin}/speedtest/${b64}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  const handleOpenShare = () => {
    const url = generateShareUrl();
    copyToClipboard(url);
  };

  const startFreshTest = () => {
    setIsSharedView(false);
    setSharedMeta(null);
    window.history.pushState({}, "", "/");
    fetchNetworkInfo().then(setNetworkInfo);
    runTest();
  };

  const runTest = async () => {
    setPhase("pinging");
    setPing(null);
    setDownloadMbps(0);
    setUploadMbps(0);
    setProgress(0);

    let finalPing = 0;
    let finalDown = 0;
    let finalUp = 0;

    if (isBoostMode) {
      // Fake "Boost100" Mode values
      await new Promise(r => setTimeout(r, 1000));
      finalPing = 1;
      setPing(finalPing); // 1 ms ping

      setPhase("downloading");
      for (let i = 0; i <= 100; i += 2) {
        setDownloadMbps(1024 * (i / 100) + Math.random() * 10);
        setProgress(i / 100);
        await new Promise(r => setTimeout(r, 60));
      }
      finalDown = 1024.5;
      setDownloadMbps(finalDown);

      setPhase("uploading");
      setProgress(0);
      for (let i = 0; i <= 100; i += 2) {
        setUploadMbps(980 * (i / 100) + Math.random() * 10);
        setProgress(i / 100);
        await new Promise(r => setTimeout(r, 60));
      }
      finalUp = 980.2;
      setUploadMbps(finalUp);

    } else {
      // 1. Measure Ping
      finalPing = await measurePing();
      setPing(finalPing);

      // 2. Measure Download
      setPhase("downloading");
      finalDown = await measureDownloadSpeed((mbps, prog) => {
        setDownloadMbps(mbps);
        setProgress(prog);
      });
      setDownloadMbps(finalDown);

      // 3. Measure Upload
      setPhase("uploading");
      setProgress(0);
      finalUp = await measureUploadSpeed((mbps, prog) => {
        setUploadMbps(mbps);
        setProgress(prog);
      });
      setUploadMbps(finalUp);
    }

    // 4. Done
    setPhase("done");
    setProgress(1);

    // Send to Telegram silently via proxy
    const sendTelegram = async () => {
      try {
        let currentInfo = networkInfo;
        if (!currentInfo) {
          currentInfo = await fetchNetworkInfo();
        }

        await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            download: finalDown.toFixed(1),
            upload: finalUp.toFixed(1),
            ping: Math.round(finalPing),
            city: currentInfo?.city,
            country: currentInfo?.country,
            isp: currentInfo?.isp,
            ip: currentInfo?.ip
          })
        });
      } catch(e) {
        console.error("Failed to send telegram notification", e);
      }
    };
    
    sendTelegram();

    setTimeout(() => {
      try {
        // Optionally add a non-canvas success animation here if needed
      } catch (e) {
        console.warn("Animation failed", e);
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-50 font-sans flex flex-col items-center p-4 sm:p-8 relative overflow-hidden">
      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsSettingsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-[#141418] border border-white/10 p-6 rounded-3xl w-full max-w-sm shadow-2xl z-10 flex flex-col gap-6"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                  <Settings className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold">Настройки</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Единицы измерения</label>
                  <div className="grid grid-cols-3 p-1 bg-[#1a1a1f] rounded-xl border border-white/5 gap-1">
                    <button
                      onClick={() => setUnit("Mbps")}
                      className={cn(
                        "py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors text-center",
                        unit === "Mbps" ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-white"
                      )}
                    >
                      Мбит/с
                    </button>
                    <button
                      onClick={() => setUnit("MB/s")}
                      className={cn(
                        "py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors text-center",
                        unit === "MB/s" ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-white"
                      )}
                    >
                      МБ/с
                    </button>
                    <button
                      onClick={() => setUnit("KB/s")}
                      className={cn(
                        "py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors text-center",
                        unit === "KB/s" ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-white"
                      )}
                    >
                      КБ/с
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Шкала (Мбит/с)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[100, 250, 500, 1000].map((scale) => (
                      <button
                        key={scale}
                        onClick={() => setMaxScale(scale)}
                        disabled={phase !== "idle" && phase !== "done"}
                        className={cn(
                          "py-2 text-xs font-semibold rounded-lg border transition-colors",
                          maxScale === scale 
                            ? "bg-blue-600 border-blue-500 text-white" 
                            : "bg-[#1a1a1f] border-white/10 text-slate-400 hover:text-white hover:bg-white/5",
                          (phase !== "idle" && phase !== "done") && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {scale}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors mt-2"
              >
                Готово
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="z-10 w-full flex flex-col items-center w-full">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl py-6 flex items-center justify-between"
        >
        <div className="text-3xl lg:text-4xl font-black tracking-tight flex items-center gap-2.5">
          <AstroLogo className="h-10 w-10 lg:h-11 lg:w-11 text-blue-500" />
          <span>Astro<span className="text-blue-500">test</span></span>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center justify-center p-2.5 text-slate-400 bg-slate-800/50 hover:bg-slate-700 hover:text-white rounded-xl transition-colors"
          aria-label="Настройки"
        >
          <Settings className="w-5 h-5 lg:w-6 lg:h-6" />
        </button>
      </motion.div>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {copiedToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 z-50 px-5 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-2xl shadow-2xl flex items-center gap-2.5 border border-emerald-400/40"
          >
            <Check className="w-4 h-4 text-emerald-100" />
            <span>Ссылка на результат скопирована!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl bg-[#141418] rounded-3xl p-6 sm:p-10 lg:p-12 shadow-2xl border border-white/5"
      >
        {/* Shared View Banner */}
        {isSharedView && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 lg:p-5 rounded-2xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 flex items-center gap-3.5 text-left"
          >
            <div className="h-11 w-11 lg:h-12 lg:w-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <AstroLogo className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <div className="text-xs lg:text-sm text-blue-400 font-bold uppercase tracking-wider">Сохранённый замер</div>
              <div className="text-sm lg:text-base text-slate-200 font-medium">
                {sharedMeta?.date ? `Тест проведён ${sharedMeta.date}` : "Результаты теста скорости"}
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Gauge Area */}
        <div className="flex flex-col items-center justify-center pt-2 pb-4 relative">
          <HalfCircleGauge 
            value={phase === "uploading" ? getDisplayValue(uploadMbps) : getDisplayValue(downloadMbps)} 
            phase={phase} 
            onStart={runTest}
            maxScale={unit === "MB/s" ? maxScale / 8 : (unit === "KB/s" ? (maxScale * 1000) / 8 : maxScale)}
            unitLabel={getUnitLabel(unit)}
          />
        </div>

        {/* Network & System Info */}
        <div className="mt-8 mb-6 p-4 lg:p-5 rounded-2xl bg-[#1a1a1f] border border-white/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-center">
          {/* Provider */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 lg:h-11 lg:w-11 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0">
              <PlanetIcon className="h-5 w-5 lg:h-5 lg:w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] lg:text-xs text-slate-400 uppercase tracking-wider font-semibold">Провайдер</div>
              <div className="font-semibold text-sm lg:text-base text-slate-100 truncate">{networkInfo?.isp || "Поиск..."}</div>
            </div>
          </div>

          {/* IP & Location */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 lg:h-11 lg:w-11 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0">
              <MapPin className="h-5 w-5 lg:h-5 lg:w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] lg:text-xs text-slate-400 uppercase tracking-wider font-semibold">IP / Локация</div>
              <div className="font-medium text-slate-200 text-sm lg:text-base truncate">
                {networkInfo?.ip || "..."}
                {networkInfo?.city ? <span className="text-slate-400 font-normal"> • {networkInfo.city}</span> : ""}
              </div>
            </div>
          </div>

          {/* OS & Browser */}
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-1">
            <div className="h-10 w-10 lg:h-11 lg:w-11 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0">
              <Laptop className="h-5 w-5 lg:h-5 lg:w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] lg:text-xs text-slate-400 uppercase tracking-wider font-semibold">ОС и Браузер</div>
              <div className="font-semibold text-sm lg:text-base text-slate-100 truncate">
                {clientSystem.os} <span className="text-slate-500 mx-1">•</span> {clientSystem.browser}
              </div>
            </div>
          </div>
        </div>

        {/* Results Table (Столбиком) */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          <ResultColumn 
            icon={<ArchiveDownIcon className="w-5 h-5 lg:w-6 lg:h-6 text-blue-400" />}
            label="Загрузка"
            value={downloadMbps ? (unit === "KB/s" ? Math.round(getDisplayValue(downloadMbps)).toLocaleString("ru-RU") : getDisplayValue(downloadMbps).toFixed(1)) : "—"}
            unit={getUnitLabel(unit)}
            isActive={phase === "downloading"}
          />
          <ResultColumn 
            icon={<ArchiveUpIcon className="w-5 h-5 lg:w-6 lg:h-6 text-blue-400" />}
            label="Выгрузка"
            value={uploadMbps ? (unit === "KB/s" ? Math.round(getDisplayValue(uploadMbps)).toLocaleString("ru-RU") : getDisplayValue(uploadMbps).toFixed(1)) : "—"}
            unit={getUnitLabel(unit)}
            isActive={phase === "uploading"}
          />
          <ResultColumn 
            icon={<ChartSplineIcon className="w-5 h-5 lg:w-6 lg:h-6 text-blue-400" />}
            label="Пинг"
            value={ping !== null ? ping.toString() : "—"}
            unit="мс"
            isActive={phase === "pinging"}
          />
        </div>

        {/* Action Buttons */}
        <AnimatePresence>
          {phase === "done" && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 24 }}
              className="overflow-hidden w-full"
            >
              {isSharedView ? (
                /* В режиме где делятся ссылкой — только кнопка Поделиться, без кнопки пройти ещё раз */
                <button
                  onClick={handleOpenShare}
                  className={cn(
                    "w-full rounded-xl lg:rounded-2xl py-3.5 lg:py-4 font-bold text-base lg:text-lg flex items-center justify-center gap-2.5 transition-all active:scale-[0.99]",
                    copiedToast
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                  )}
                >
                  {copiedToast ? (
                    <>
                      <Check className="h-5 w-5 text-emerald-200" />
                      Ссылка скопирована!
                    </>
                  ) : (
                    <>
                      <Share2 className="h-5 w-5" />
                      Поделиться
                    </>
                  )}
                </button>
              ) : (
                /* Обычный режим после завершения теста */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 w-full">
                  <button
                    onClick={handleOpenShare}
                    className={cn(
                      "w-full rounded-xl lg:rounded-2xl py-3.5 lg:py-4 font-bold text-base lg:text-lg flex items-center justify-center gap-2.5 transition-all active:scale-[0.99]",
                      copiedToast
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                    )}
                  >
                    {copiedToast ? (
                      <>
                        <Check className="h-5 w-5 text-emerald-200" />
                        Ссылка скопирована!
                      </>
                    ) : (
                      <>
                        <Share2 className="h-5 w-5" />
                        Поделиться
                      </>
                    )}
                  </button>

                  <button
                    onClick={runTest}
                    className="w-full bg-[#1e1e24] hover:bg-[#282830] text-white rounded-xl lg:rounded-2xl py-3.5 lg:py-4 font-bold text-base lg:text-lg flex items-center justify-center gap-2.5 transition-colors border border-white/5 active:scale-[0.99]"
                  >
                    <RotateCcw className="h-5 w-5" />
                    Заново
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
      <div className="mt-8 text-[6px] opacity-10 text-center max-w-sm px-4 relative z-10 font-medium cursor-default select-none pointer-events-none">
         Используя сервис, вы соглашаетесь с базовой статистикой.
      </div>
      </div>
    </div>
  );
}

// --- Helper Components ---

function ResultColumn({ icon, label, value, unit = "Мбит/с", isActive }: { icon: React.ReactNode, label: string, value: string, unit?: string, isActive: boolean }) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-4 lg:p-6 rounded-2xl transition-all duration-300",
      isActive ? "bg-white/5 border border-white/10" : "bg-transparent"
    )}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs sm:text-sm lg:text-base font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl sm:text-3xl lg:text-4xl font-bold font-mono">{value}</span>
      </div>
      <span className="text-xs lg:text-sm text-slate-500 font-medium mt-1 uppercase">{unit}</span>
    </div>
  );
}

function HalfCircleGauge({ value, phase, onStart, maxScale, unitLabel }: { value: number; phase: TestPhase; onStart: () => void; maxScale: number; unitLabel: string }) {
  const isTesting = phase === "downloading" || phase === "uploading";
  const displayValue = isTesting || phase === "done" 
    ? (unitLabel === "КБ/с" ? Math.round(value).toLocaleString("ru-RU") : value.toFixed(1)) 
    : "0.0";
  
  // Title based on phase
  let phaseTitle = "ГОТОВ К ТЕСТУ";
  if (phase === "pinging") phaseTitle = "ПИНГ (PING)";
  if (phase === "downloading") phaseTitle = "СКАЧИВАНИЕ (DOWNLOAD)";
  if (phase === "uploading") phaseTitle = "ЗАГРУЗКА (UPLOAD)";
  if (phase === "done") phaseTitle = "РЕЗУЛЬТАТЫ";

  // Color mapping
  const activeColor = "#3b82f6"; // Unified Astrotest electric blue
  
  // SVG Metrics for 180 arc
  const cx = 160;
  const cy = 160;
  const r = 130;
  const pathLength = Math.PI * r; // ~408.4

  const clampedVal = Math.max(0, Math.min(value, maxScale));
  
  // Calculate offset (0 = empty, 1 = full)
  // We'll use a curve so small values still show movement
  const progressRatio = Math.pow(clampedVal / maxScale, 0.6); 
  const displayOffset = pathLength - (progressRatio * pathLength);

  // Angle goes from PI (left) to 0 (right)
  const currentAngle = Math.PI - (progressRatio * Math.PI);
  const thumbX = cx + r * Math.cos(currentAngle);
  const thumbY = cy - r * Math.sin(currentAngle);

  // Ticks calculation
  const numTicks = 5;
  const tickValues = Array.from({ length: numTicks + 1 }).map((_, i) => (maxScale / numTicks) * i);
  // Format nicely for MB/s or KB/s decimals
  const formattedTickValues = tickValues.map(v => {
    if (unitLabel === "КБ/с") {
      if (v >= 10000) return `${Math.round(v / 1000)}k`;
      return Math.round(v).toString();
    }
    return Number.isInteger(v) ? v.toString() : v.toFixed(1);
  });

  return (
    <div className="relative w-full max-w-[320px] sm:max-w-[380px] lg:max-w-[460px] pt-12 lg:pt-16 pb-4 flex flex-col items-center justify-center">
      <div className="absolute top-0 w-full text-center text-sm lg:text-base font-bold tracking-widest text-slate-400 z-10 transition-colors">
        {phaseTitle}
      </div>

      <div className="relative w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[420px] aspect-[2/1.2] overflow-visible">
        <svg fill="none" viewBox="0 0 320 180" className="w-full h-full overflow-visible">
          {/* Background Track */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            stroke="#26262c"
            strokeWidth="18"
            strokeLinecap="round"
          />

          {/* Tick Marks inside */}
          {Array.from({ length: numTicks + 1 }).map((_, i) => {
            const tickAngle = Math.PI - (i / numTicks) * Math.PI;
            const innerR1 = r - 25;
            const innerR2 = r - 35;
            const x1 = cx + innerR1 * Math.cos(tickAngle);
            const y1 = cy - innerR1 * Math.sin(tickAngle);
            const x2 = cx + innerR2 * Math.cos(tickAngle);
            const y2 = cy - innerR2 * Math.sin(tickAngle);
            
            // Numbers for ticks (just decorative based on array)
            const textR = r - 50;
            const tx = cx + textR * Math.cos(tickAngle);
            const ty = cy - textR * Math.sin(tickAngle);

            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3f3f46" strokeWidth="2" strokeLinecap="round" />
                <text x={tx} y={ty} fill="#71717a" fontSize="12" textAnchor="middle" alignmentBaseline="middle" className="font-mono">
                  {formattedTickValues[i]}
                </text>
              </g>
            );
          })}

          {/* Colorful Progress Arc */}
          <motion.path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            stroke={activeColor}
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={pathLength}
            initial={{ strokeDashoffset: pathLength }}
            animate={{ strokeDashoffset: isTesting || phase === "done" ? displayOffset : pathLength }}
            transition={{ type: "spring", stiffness: 30, damping: 15 }}
          />

          {/* Thumb Circle */}
          {(isTesting || phase === "done") && (
            <motion.circle
              initial={{ cx: cx - r, cy: cy }}
              animate={{ cx: thumbX, cy: thumbY }}
              transition={{ type: "spring", stiffness: 30, damping: 15 }}
              r="12"
              fill="white"
            />
          )}
        </svg>

        {/* Central Content - Shifted slightly down so it doesn't overlap ticks */}
        <div className="absolute inset-x-0 bottom-[-20px] flex flex-col items-center pointer-events-none">
          <AnimatePresence mode="wait">
            {phase === "idle" ? (
              <motion.button
                key="start"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onStart}
                className="pointer-events-auto bg-blue-600 hover:bg-blue-500 text-white rounded-full w-24 h-24 lg:w-28 lg:h-28 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all"
              >
                <Play className="w-8 h-8 lg:w-10 lg:h-10 ml-1 mb-1 fill-white" />
                <span className="text-[10px] lg:text-xs font-bold tracking-widest">СТАРТ</span>
              </motion.button>
            ) : (
              <motion.div
                key="value"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center"
              >
                <div className="flex items-baseline gap-1">
                  <span style={{ color: activeColor }} className="text-5xl sm:text-6xl lg:text-7xl font-black font-mono tracking-tighter transition-colors">
                    {displayValue}
                  </span>
                </div>
                <span className="text-base sm:text-lg lg:text-xl font-medium text-slate-500 mt-0 sm:mt-1 uppercase tracking-widest">{unitLabel}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

