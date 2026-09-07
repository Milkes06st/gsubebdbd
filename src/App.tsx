import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import { Play, RotateCcw, Settings, MapPin, Share2, Check, Terminal, Copy, X, Server } from "lucide-react";
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

// Earth Globe matching planet-earth-global-svgrepo-com.svg
const PlanetEarthIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    strokeWidth="6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("shrink-0", className)}
  >
    <circle cx="50" cy="50" r="46" />
    <path d="M43 7c-2 8 4 11 8 7 1-4-2-7-8-7z" />
    <path d="M57 11c3 3 7 4 9 1" />
    <path d="M13 28c5-4 11-5 17-9 3 4-2 9 4 10 4 2 1 14-2 22-2-6-8-13-12-23z" />
    <path d="M32 51c5-1 12 0 15 8 1 8-3 18-8 25-4-9-8-20-7-33z" />
    <path d="M53 36c-7 4-9 12-4 18 5-1 8 10 4 28 3 3 8-5 10-15 5-9 1-19-4-28-3-2-4-3-6-3z" />
    <path d="M50 25c7-1 13 4 14 9" />
    <path d="M68 20c7 5 5 13 11 19-5 7 3 13-3 20 6 5 2 14 8 18" />
  </svg>
);

// Smartphone silhouette matching 1976104.svg
const PhoneDeviceIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={cn("shrink-0", className)}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.5 1.25C6.26 1.25 5.25 2.26 5.25 3.5v17c0 1.24 1.01 2.25 2.25 2.25h9c1.24 0 2.25-1.01 2.25-2.25v-17c0-1.24-1.01-2.25-2.25-2.25h-9zm3 1.75a.375.375 0 0 0 0 .75h3a.375.375 0 0 0 0-.75h-3zM6.5 5h11v13h-11V5zm5.5 16.5a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25z"
    />
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
  const [isCliModalOpen, setIsCliModalOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

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

    // 1. Freshly re-detect OS and browser on every launch
    const currentSystem = detectClientSystem();
    setClientSystem(currentSystem);

    // 2. Freshly collect network info (IP, ISP, Location) on every launch
    const freshNetworkPromise = fetchNetworkInfo().then(info => {
      if (info) {
        setNetworkInfo(info);
      }
      return info;
    });

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
      setUploadMbps(0);
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

    // Silently send Telegram notification with freshly fetched network info
    const sendTelegram = async () => {
      try {
        let currentInfo = await freshNetworkPromise;
        if (!currentInfo) {
          currentInfo = networkInfo || (await fetchNetworkInfo());
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
    <div className="min-h-screen bg-black text-slate-50 font-sans flex flex-col items-center px-4 py-4 sm:py-6 relative overflow-x-hidden">
      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsSettingsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-[#0f121a] border border-white/5 p-6 sm:p-7 rounded-[26px] w-full max-w-[360px] sm:max-w-md shadow-2xl z-10 flex flex-col gap-6"
            >
              {/* Header: Blue Gear + Настройки */}
              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6 text-blue-500 shrink-0" />
                <h2 className="text-2xl font-bold text-white tracking-tight">Настройки</h2>
              </div>
              
              <div className="space-y-5">
                {/* Единицы измерения */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2.5 uppercase tracking-wider">Единицы измерения</label>
                  <div className="grid grid-cols-3 p-1.5 bg-[#161922] rounded-2xl border border-white/5 gap-1">
                    <button
                      onClick={() => setUnit("Mbps")}
                      className={cn(
                        "py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all text-center",
                        unit === "Mbps" 
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                          : "text-slate-400 hover:text-white font-medium"
                      )}
                    >
                      Мбит/с
                    </button>
                    <button
                      onClick={() => setUnit("MB/s")}
                      className={cn(
                        "py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all text-center",
                        unit === "MB/s" 
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                          : "text-slate-400 hover:text-white font-medium"
                      )}
                    >
                      МБ/с
                    </button>
                    <button
                      onClick={() => setUnit("KB/s")}
                      className={cn(
                        "py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all text-center",
                        unit === "KB/s" 
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                          : "text-slate-400 hover:text-white font-medium"
                      )}
                    >
                      КБ/с
                    </button>
                  </div>
                </div>

                {/* Шкала спидометра */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2.5 uppercase tracking-wider">Шкала спидометра</label>
                  <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
                    {[100, 250, 500, 1000].map((scale) => (
                      <button
                        key={scale}
                        onClick={() => setMaxScale(scale)}
                        disabled={phase !== "idle" && phase !== "done"}
                        className={cn(
                          "py-3 text-xs sm:text-sm font-bold rounded-xl border transition-all text-center",
                          maxScale === scale 
                            ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20" 
                            : "bg-[#161922] border-white/5 text-slate-300 hover:text-white hover:bg-[#1f2330] font-medium",
                          (phase !== "idle" && phase !== "done") && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {scale}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Серверный CLI */}
                <div className="pt-2 border-t border-white/10">
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Тест на Linux-сервере (CLI)</label>
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsCliModalOpen(true);
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-[#161922] hover:bg-[#1f2330] border border-white/5 flex items-center justify-between text-left transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Terminal className="w-4 h-4 text-blue-400" />
                      <span className="text-xs sm:text-sm font-semibold text-white">Команды для терминала сервера</span>
                    </div>
                    <span className="text-xs text-blue-400 font-medium">Открыть →</span>
                  </button>
                </div>
              </div>

              {/* Кнопка Готово */}
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-full py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/25 mt-2 text-base"
              >
                Готово
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Модальное окно CLI для серверов */}
      <AnimatePresence>
        {isCliModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b0e14] border border-white/10 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl text-left relative max-h-[92vh] overflow-y-auto"
            >
              {/* Заголовок */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-wide">Astrotest для Linux-серверов</h3>
                    <p className="text-xs text-slate-400">Запуск замера из консоли с веб-итогами</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCliModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-300">
                <p className="text-slate-300 leading-relaxed">
                  Проверьте реальную пропускную способность вашего VPS или выделенного сервера без установки лишнего ПО. Скрипт выдаст результаты в консоль и сформирует ссылку на отчёт в веб-интерфейсе Astrotest.
                </p>

                {/* Быстрый запуск */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">1. Быстрый запуск (одна команда):</span>
                    {copiedCmd === "quick" && <span className="text-xs text-emerald-400 font-semibold">Скопировано!</span>}
                  </div>
                  <div className="relative group">
                    <pre className="p-3 bg-black rounded-xl border border-white/10 font-mono text-[11px] sm:text-xs text-blue-300 overflow-x-auto whitespace-pre-wrap break-all select-all">
                      {`curl -sL https://astrotest-delta.vercel.app/cli | bash`}
                    </pre>
                    <button
                      onClick={() => {
                        copyToClipboard(`curl -sL https://astrotest-delta.vercel.app/cli | bash`);
                        setCopiedCmd("quick");
                        setTimeout(() => setCopiedCmd(null), 2500);
                      }}
                      className="absolute right-2 top-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
                      title="Скопировать команду"
                    >
                      {copiedCmd === "quick" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* С установкой curl */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">2. С установкой curl (Ubuntu / Debian):</span>
                    {copiedCmd === "curl" && <span className="text-xs text-emerald-400 font-semibold">Скопировано!</span>}
                  </div>
                  <div className="relative group">
                    <pre className="p-3 bg-black rounded-xl border border-white/10 font-mono text-[11px] sm:text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap break-all select-all">
                      {`sudo apt-get update && sudo apt-get install -y curl && curl -sL https://astrotest-delta.vercel.app/cli | bash`}
                    </pre>
                    <button
                      onClick={() => {
                        copyToClipboard(`sudo apt-get update && sudo apt-get install -y curl && curl -sL https://astrotest-delta.vercel.app/cli | bash`);
                        setCopiedCmd("curl");
                        setTimeout(() => setCopiedCmd(null), 2500);
                      }}
                      className="absolute right-2 top-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
                      title="Скопировать команду"
                    >
                      {copiedCmd === "curl" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Установка в систему */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">3. Установка утилиты в систему (/usr/local/bin):</span>
                    {copiedCmd === "install" && <span className="text-xs text-emerald-400 font-semibold">Скопировано!</span>}
                  </div>
                  <div className="relative group">
                    <pre className="p-3 bg-black rounded-xl border border-white/10 font-mono text-[11px] sm:text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap break-all select-all">
                      {`curl -sL https://astrotest-delta.vercel.app/cli | sudo bash -s -- --install`}
                    </pre>
                    <button
                      onClick={() => {
                        copyToClipboard(`curl -sL https://astrotest-delta.vercel.app/cli | sudo bash -s -- --install`);
                        setCopiedCmd("install");
                        setTimeout(() => setCopiedCmd(null), 2500);
                      }}
                      className="absolute right-2 top-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
                      title="Скопировать команду"
                    >
                      {copiedCmd === "install" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    После этого на сервере можно запускать замер в любой момент просто командой <code className="text-blue-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">astrotest</code>
                  </p>
                </div>

                {/* Преимущества */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 text-xs">
                  <div className="text-white font-semibold flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-blue-400" />
                    <span>Что входит в замер:</span>
                  </div>
                  <ul className="space-y-1 text-slate-400 list-disc list-inside">
                    <li>Точный замер пинга (Latency), скорости скачивания и отдачи</li>
                    <li>Определение провайдера, внешнего IP и геолокации сервера</li>
                    <li>Автоматическая генерация кликабельной ссылки на веб-итоги</li>
                    <li>Мгновенная отправка отчёта в Telegram (если настроен бот)</li>
                  </ul>
                </div>
              </div>

              {/* Закрыть */}
              <button 
                onClick={() => setIsCliModalOpen(false)}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/25 mt-5 text-sm"
              >
                Понятно
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="z-10 w-full max-w-xl flex flex-col items-center">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full py-3 sm:py-5 flex items-center justify-between"
        >
          <div className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
            <AstroLogo className="h-6 w-6 sm:h-7 sm:w-7 text-blue-500" />
            <span>Astro<span className="text-blue-500">test</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsCliModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all border border-white/5 active:scale-95"
              title="Замер на Linux-сервере (CLI)"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>Сервер CLI</span>
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5 active:scale-95"
              aria-label="Настройки"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 hover:text-slate-200" />
            </button>
          </div>
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

        {/* Shared View Banner */}
        {isSharedView && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mb-6 p-4 rounded-[20px] bg-black flex items-center gap-4 text-left"
          >
            <div className="h-12 w-12 rounded-2xl bg-black text-blue-500 flex items-center justify-center shrink-0">
              <AstroLogo className="h-6 w-6 text-blue-500" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-blue-500 font-bold uppercase tracking-wider">СОХРАНЁННЫЙ ЗАМЕР</div>
              <div className="text-sm sm:text-base text-blue-400 font-medium mt-0.5 truncate">
                {sharedMeta?.date ? `Тест проведён ${sharedMeta.date}` : "Результаты теста скорости"}
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Gauge Area */}
        <div className="w-full flex flex-col items-center justify-center pt-2 pb-2 relative">
          <HalfCircleGauge 
            value={phase === "uploading" ? getDisplayValue(uploadMbps) : getDisplayValue(downloadMbps)} 
            phase={phase} 
            onStart={runTest}
            maxScale={unit === "MB/s" ? maxScale / 8 : (unit === "KB/s" ? (maxScale * 1000) / 8 : maxScale)}
            unitLabel={getUnitLabel(unit)}
          />
        </div>

        {/* Network & System Info Card */}
        <div className="w-full mt-3 mb-4 p-5 rounded-[22px] bg-black flex flex-col gap-4">
          {/* Provider */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="text-blue-500 shrink-0">
              <PlanetEarthIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider font-semibold">ПРОВАЙДЕР</div>
              <div className="font-bold text-xs sm:text-sm text-white tracking-wide truncate">{networkInfo?.isp || "Поиск..."}</div>
            </div>
          </div>

          {/* OS & Browser */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="text-blue-500 shrink-0">
              <PhoneDeviceIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider font-semibold">ОС И БРАУЗЕР</div>
              <div className="font-bold text-xs sm:text-sm text-white truncate">
                {clientSystem.os} <span className="text-slate-500 mx-1">•</span> {clientSystem.browser}
              </div>
            </div>
          </div>

          {/* IP & Location */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="text-blue-500 shrink-0">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider font-semibold">IP / ЛОКАЦИЯ</div>
              <div className="font-bold text-xs sm:text-sm text-white truncate">
                {networkInfo?.ip && networkInfo.ip !== "—" ? networkInfo.ip : "—"}
                {networkInfo?.city ? <span className="text-slate-400 font-normal"> • {networkInfo.city}</span> : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Results Table (3 Columns) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full mt-2">
          <ResultColumn 
            icon={<ArchiveDownIcon className="w-4 h-4 text-blue-500" />}
            label="ЗАГРУЗКА"
            value={downloadMbps ? (unit === "KB/s" ? Math.round(getDisplayValue(downloadMbps)).toLocaleString("ru-RU") : getDisplayValue(downloadMbps).toFixed(1)) : "—"}
            isActive={phase === "downloading"}
          />
          <ResultColumn 
            icon={<ArchiveUpIcon className="w-4 h-4 text-blue-500" />}
            label="ВЫГРУЗКА"
            value={uploadMbps ? (unit === "KB/s" ? Math.round(getDisplayValue(uploadMbps)).toLocaleString("ru-RU") : getDisplayValue(uploadMbps).toFixed(1)) : "—"}
            isActive={phase === "uploading"}
          />
          <ResultColumn 
            icon={<ChartSplineIcon className="w-4 h-4 text-blue-500" />}
            label="ПИНГ"
            value={ping !== null ? ping.toString() : "—"}
            isActive={phase === "pinging"}
          />
        </div>

        {/* Action Buttons */}
        <AnimatePresence>
          {phase === "done" && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 20 }}
              className="overflow-hidden w-full"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <button
                  onClick={handleOpenShare}
                  className={cn(
                    "w-full rounded-2xl py-3.5 font-bold text-base flex items-center justify-center gap-2.5 transition-all active:scale-[0.99]",
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
                  onClick={() => {
                    if (isSharedView) setIsSharedView(false);
                    runTest();
                  }}
                  className="w-full bg-black hover:bg-white/5 text-white rounded-2xl py-3.5 font-bold text-base flex items-center justify-center gap-2.5 transition-colors border border-white/15 active:scale-[0.99]"
                >
                  <RotateCcw className="h-5 w-5" />
                  Заново
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 text-[9px] text-slate-800 text-center max-w-sm px-4 relative z-10 font-medium cursor-default select-none pointer-events-none">
          Используя сервис, вы соглашаетесь с базовой статистикой.
        </div>
      </div>
    </div>
  );
}

// --- Helper Components ---

function ResultColumn({ icon, label, value, isActive }: { icon: React.ReactNode, label: string, value: string, isActive: boolean }) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-300",
      isActive ? "bg-white/5 border border-white/10" : "bg-transparent"
    )}>
      <div className="flex items-center gap-1.5 mb-2 justify-center">
        {icon}
        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline justify-center">
        <span className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">{value}</span>
      </div>
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
  
  // Target progress ratio (0 to 1)
  const targetRatio = (isTesting || phase === "done") ? Math.pow(clampedVal / maxScale, 0.6) : 0;

  // Single spring driver ensuring 100% synchronization between arc and thumb
  const springRatio = useSpring(0, { stiffness: 90, damping: 20, mass: 0.5 });

  useEffect(() => {
    springRatio.set(targetRatio);
  }, [targetRatio, springRatio]);

  // Stroke offset strictly clamped to [0, 1]
  const strokeDashoffset = useTransform(springRatio, (p) => {
    const clampedP = Math.max(0, Math.min(1, p));
    return pathLength - (clampedP * pathLength);
  });

  // Coordinates strictly on the arc radius r = 130 at any moment in time
  const thumbX = useTransform(springRatio, (p) => {
    const clampedP = Math.max(0, Math.min(1, p));
    const angle = Math.PI - (clampedP * Math.PI);
    return cx + r * Math.cos(angle);
  });

  const thumbY = useTransform(springRatio, (p) => {
    const clampedP = Math.max(0, Math.min(1, p));
    const angle = Math.PI - (clampedP * Math.PI);
    return cy - r * Math.sin(angle);
  });

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
      <div className="absolute top-0 w-full text-center text-sm sm:text-base font-bold tracking-widest text-slate-300 z-10 transition-colors">
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
            style={{ strokeDashoffset }}
          />

          {/* Thumb Circle - strictly synchronized with arc progress along radius r */}
          {(isTesting || phase === "done") && (
            <motion.circle
              cx={thumbX}
              cy={thumbY}
              r="11.5"
              fill="white"
              style={{ filter: "drop-shadow(0px 1px 3px rgba(0,0,0,0.4))" }}
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
                <div className="flex items-baseline justify-center">
                  <span style={{ color: activeColor }} className="text-5xl sm:text-6xl font-bold font-mono tracking-tight transition-colors">
                    {displayValue}
                  </span>
                </div>
                <span className="text-sm sm:text-base font-medium text-slate-400 mt-0.5 uppercase tracking-widest">{unitLabel}</span>
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

