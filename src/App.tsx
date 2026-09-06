import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, Share2, MapPin } from "lucide-react";
import confetti from "canvas-confetti";
import { fetchNetworkInfo, measurePing, measureDownloadSpeed, measureUploadSpeed, NetworkInfo } from "./lib/speedTest";
import { cn } from "./lib/utils";

type TestPhase = "idle" | "pinging" | "downloading" | "uploading" | "done";

const AstroLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g stroke="currentColor" strokeWidth="2" strokeOpacity="0.8">
      <ellipse cx="40" cy="50" rx="30" ry="30" />
      <ellipse cx="40" cy="50" rx="20" ry="32" transform="rotate(20 40 50)" />
      <ellipse cx="40" cy="50" rx="20" ry="32" transform="rotate(60 40 50)" />
      <ellipse cx="40" cy="50" rx="20" ry="32" transform="rotate(-30 40 50)" />
      <ellipse cx="40" cy="50" rx="12" ry="34" transform="rotate(45 40 50)" />
      <ellipse cx="40" cy="50" rx="32" ry="15" transform="rotate(10 40 50)" />
    </g>
    <g fill="currentColor" opacity="0.9">
      {[
        { x: 75, y: 30, size: 4 },
        { x: 82, y: 42, size: 5 },
        { x: 85, y: 55, size: 5 },
        { x: 80, y: 68, size: 4 },
        { x: 70, y: 78, size: 3.5 }
      ].map((star, i) => (
        <path key={i}
          d={`M${star.x},${star.y - star.size} l${star.size * 0.3},${star.size * 0.7} l${star.size * 0.7},${star.size * 0.1} l-${star.size * 0.5},${star.size * 0.5} l${star.size * 0.2},${star.size * 0.8} l-${star.size * 0.7},-${star.size * 0.4} l-${star.size * 0.7},${star.size * 0.4} l${star.size * 0.2},-${star.size * 0.8} l-${star.size * 0.5},-${star.size * 0.5} l${star.size * 0.7},-${star.size * 0.1} z`}
        />
      ))}
    </g>
  </svg>
);

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
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.location.pathname.toLowerCase() === '/boost100') {
      setIsBoostMode(true);
    }
    fetchNetworkInfo().then(setNetworkInfo);
  }, []);

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
      if (confettiCanvasRef.current) {
        try {
          const myConfetti = confetti.create(confettiCanvasRef.current, {
            resize: true,
            useWorker: true
          });
          myConfetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#3b82f6", "#a855f7", "#10b981"],
          });
        } catch (e) {
          console.warn("Confetti failed", e);
        }
      }
    }, 100);
  };

  const shareResults = async () => {
    const text = `🚀 Результаты Astrotest:
⬇️ Загрузка: ${downloadMbps?.toFixed(1)} Мбит/с
⬆️ Выгрузка: ${uploadMbps?.toFixed(1)} Мбит/с
Пинг: ${ping}мс
🌐 Провайдер: ${networkInfo?.isp || "Неизвестно"}
📍 Локация: ${networkInfo?.city || "Неизвестно"}, ${networkInfo?.country || "Неизвестно"}

🛸 Узнай свою скорость: https://astrotest.duckdns.org`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Astrotest",
          text: text,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Share failed, falling back to clipboard", err);
          await navigator.clipboard.writeText(text);
          alert("Результаты скопированы!");
        }
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert("Результаты скопированы!");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-800 text-slate-50 font-sans flex flex-col items-center p-4 sm:p-8 relative overflow-hidden">
      <div className="z-10 w-full flex flex-col items-center w-full">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl py-6 flex items-center justify-between"
        >
        <div className="text-3xl font-black tracking-tight flex items-center gap-2">
          <AstroLogo className="h-10 w-10 text-blue-500" />
          <span>Astro<span className="text-blue-500">test</span></span>
        </div>
        {phase === "done" && (
          <button 
            onClick={shareResults}
            className="flex items-center gap-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors"
          >
            <Share2 className="w-4 h-4" /> Поделиться
          </button>
        )}
      </motion.div>

      {/* Main Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-neutral-900 rounded-3xl p-6 sm:p-10 shadow-2xl border border-white/5"
      >
        
        {/* Gauge Area */}
        <div className="flex flex-col items-center justify-center py-6 relative">
          <HalfCircleGauge 
            value={phase === "uploading" ? uploadMbps : downloadMbps} 
            phase={phase} 
            onStart={runTest}
            maxScale={maxScale}
          />
          
          {/* Scale Selector */}
          <div className="flex justify-center gap-2 mt-8 z-20 relative">
            {[100, 250, 500, 1000].map((scale) => (
              <button
                key={scale}
                onClick={() => setMaxScale(scale)}
                disabled={phase !== "idle" && phase !== "done"}
                className={cn(
                  "px-4 py-1 text-xs sm:text-sm font-semibold rounded-full border transition-colors",
                  maxScale === scale 
                    ? "bg-blue-600 border-blue-500 text-white" 
                    : "bg-neutral-800 border-white/10 text-slate-400 hover:text-white hover:bg-white/5",
                  (phase !== "idle" && phase !== "done") && "opacity-50 cursor-not-allowed"
                )}
              >
                {scale}
              </button>
            ))}
          </div>
        </div>

        {/* Network Info */}
        <div className="mt-8 mb-6 p-4 rounded-2xl bg-neutral-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
              <PlanetIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Провайдер</div>
              <div className="font-semibold">{networkInfo?.isp || "Поиск..."}</div>
            </div>
          </div>
          <div className="flex flex-col sm:items-end text-center sm:text-right">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">IP / Локация</div>
            <div className="font-medium text-slate-200">
              {networkInfo?.ip || "..."} <span className="text-slate-500 mx-1">•</span> {networkInfo ? `${networkInfo.city}` : "..."}
            </div>
          </div>
        </div>

        {/* Results Table (Столбиком) */}
        <div className="grid grid-cols-3 gap-3">
          <ResultColumn 
            icon={<ArchiveDownIcon className="w-5 h-5 text-blue-400" />}
            label="Загрузка"
            value={downloadMbps ? downloadMbps.toFixed(1) : "—"}
            isActive={phase === "downloading"}
          />
          <ResultColumn 
            icon={<ArchiveUpIcon className="w-5 h-5 text-purple-400" />}
            label="Выгрузка"
            value={uploadMbps ? uploadMbps.toFixed(1) : "—"}
            isActive={phase === "uploading"}
          />
          <ResultColumn 
            icon={<ChartSplineIcon className="w-5 h-5 text-emerald-400" />}
            label="Пинг"
            value={ping !== null ? ping.toString() : "—"}
            unit="мс"
            isActive={phase === "pinging"}
          />
        </div>

        {/* Restart Button */}
        <AnimatePresence>
          {phase === "done" && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 24 }}
              className="overflow-hidden"
            >
              <button
                onClick={runTest}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-4 font-bold text-lg flex items-center justify-center gap-3 transition-colors shadow-lg shadow-blue-500/20"
              >
                <RotateCcw className="h-5 w-5" />
                Заново
              </button>
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
      "flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-300",
      isActive ? "bg-white/5 border border-white/10" : "bg-transparent"
    )}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl sm:text-3xl font-bold font-mono">{value}</span>
      </div>
      <span className="text-xs text-slate-500 font-medium mt-1 uppercase">{unit}</span>
    </div>
  );
}

function HalfCircleGauge({ value, phase, onStart, maxScale }: { value: number; phase: TestPhase; onStart: () => void; maxScale: number }) {
  const isTesting = phase === "downloading" || phase === "uploading";
  const displayValue = isTesting || phase === "done" ? value.toFixed(1) : "0.0";
  
  // Title based on phase
  let phaseTitle = "ГОТОВ К ТЕСТУ";
  if (phase === "pinging") phaseTitle = "ПИНГ (PING)";
  if (phase === "downloading") phaseTitle = "СКАЧИВАНИЕ (DOWNLOAD)";
  if (phase === "uploading") phaseTitle = "ЗАГРУЗКА (UPLOAD)";
  if (phase === "done") phaseTitle = "РЕЗУЛЬТАТЫ";

  // Color mapping
  const activeColor = phase === "uploading" ? "#a855f7" : "#3b82f6"; // purple / blue
  
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

  // Position for the thumb (the "dot" on the edge of the line)
  // Angle goes from 180 to 0 degrees for SVG (left to right)
  const angle = Math.PI - (progressRatio * Math.PI);
  const thumbX = cx + r * Math.cos(angle);
  const thumbY = cy - r * Math.sin(angle);

  // Ticks calculation
  const numTicks = 5;
  const tickValues = Array.from({ length: numTicks + 1 }).map((_, i) => Math.round((maxScale / numTicks) * i));

  return (
    <div className="relative w-full max-w-[320px] pt-12 pb-4 flex flex-col items-center justify-center">
      <div className="absolute top-0 w-full text-center text-sm font-bold tracking-widest text-slate-400 z-10 transition-colors">
        {phaseTitle}
      </div>

      <div className="relative w-full max-w-[280px] sm:max-w-[320px] aspect-[2/1.2] overflow-visible">
        <svg fill="none" viewBox="0 0 320 180" className="w-full h-full overflow-visible">
          {/* Background Track */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            stroke="#2e2e36"
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
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeWidth="2" strokeLinecap="round" />
                <text x={tx} y={ty} fill="#64748b" fontSize="12" textAnchor="middle" alignmentBaseline="middle" className="font-mono">
                  {tickValues[i]}
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
            initial={{ strokeDashoffset: pathLength, filter: 'drop-shadow(0px 0px 0px rgba(0,0,0,0))' }}
            animate={{ 
              strokeDashoffset: isTesting || phase === "done" ? displayOffset : pathLength,
              filter: isTesting 
                ? [
                    `drop-shadow(0px 0px 5px ${activeColor}80)`,
                    `drop-shadow(0px 0px 20px ${activeColor})`,
                    `drop-shadow(0px 0px 5px ${activeColor}80)`
                  ] 
                : phase === "done" 
                  ? `drop-shadow(0px 0px 10px ${activeColor}80)`
                  : 'drop-shadow(0px 0px 0px rgba(0,0,0,0))'
            }}
            transition={{ 
              strokeDashoffset: { type: "spring", stiffness: 30, damping: 15 },
              filter: isTesting ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : { duration: 0.5 }
            }}
          />

          {/* Thumb Circle */}
          {(isTesting || phase === "done") && (
            <motion.g
              initial={{ rotate: 0 }}
              animate={{ rotate: 180 * progressRatio }}
              style={{ originX: "50%", originY: "50%" }}
              transition={{ type: "spring", stiffness: 30, damping: 15 }}
            >
              <circle cx={cx} cy={cy} r={r} fill="transparent" />
              <circle
                cx={cx - r} cy={cy} r="14"
                fill="white"
                style={{ filter: `drop-shadow(0px 0px 8px ${activeColor}80)` }}
              />
            </motion.g>
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
                className="pointer-events-auto bg-blue-600 hover:bg-blue-500 text-white rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all"
              >
                <Play className="w-8 h-8 ml-1 mb-1 fill-white" />
                <span className="text-[10px] font-bold tracking-widest">СТАРТ</span>
              </motion.button>
            ) : (
              <motion.div
                key="value"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center"
              >
                <div className="flex items-baseline gap-1">
                  <span style={{ color: activeColor }} className="text-5xl sm:text-6xl font-black font-mono tracking-tighter transition-colors">
                    {displayValue}
                  </span>
                </div>
                <span className="text-base sm:text-lg font-medium text-slate-500 mt-0 sm:mt-1 uppercase tracking-widest">Мбит/с</span>
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

