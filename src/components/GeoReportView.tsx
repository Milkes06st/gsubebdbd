import React, { useState, useMemo } from 'react';
import { 
  SharedGeoData, 
  GeoServiceItem, 
  isIsoCountryCode, 
  getCountrySvgFlagUrl, 
  getCountryNameRu 
} from '../lib/geoData';
import { 
  Globe, 
  ShieldCheck, 
  Search, 
  Share2, 
  Check, 
  ArrowLeft, 
  Server, 
  Wifi, 
  Layers, 
  Tv, 
  Database,
  ExternalLink
} from 'lucide-react';

interface GeoReportViewProps {
  geoData: SharedGeoData;
  onBackToSpeedtest?: () => void;
  hasSpeedtestData?: boolean;
}

export const GeoReportView: React.FC<GeoReportViewProps> = ({
  geoData,
  onBackToSpeedtest,
  hasSpeedtestData = false
}) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'custom' | 'primary' | 'cdn'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Все сервисы
  const allItems = useMemo(() => {
    if (geoData.items && geoData.items.length > 0) {
      return geoData.items;
    }
    const res: GeoServiceItem[] = [];
    if (geoData.custom) res.push(...geoData.custom.map(i => ({ ...i, category: 'custom' as const })));
    if (geoData.primary) res.push(...geoData.primary.map(i => ({ ...i, category: 'primary' as const })));
    if (geoData.cdn) res.push(...geoData.cdn.map(i => ({ ...i, category: 'cdn' as const })));
    return res;
  }, [geoData]);

  // Фильтрация по категории и поиску
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      const matchCat = filterCategory === 'all' || item.category === filterCategory;
      const matchSearch = searchQuery === '' || 
        item.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.ipv4 && item.ipv4.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.ipv6 && item.ipv6.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [allItems, filterCategory, searchQuery]);

  const customCount = useMemo(() => allItems.filter(i => i.category === 'custom').length, [allItems]);
  const primaryCount = useMemo(() => allItems.filter(i => i.category === 'primary').length, [allItems]);
  const cdnCount = useMemo(() => allItems.filter(i => i.category === 'cdn').length, [allItems]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const renderValueBadge = (val?: string | null, label?: string) => {
    if (!val || val === 'null' || val === 'N/A' || val === '—') {
      return (
        <span className="text-slate-600 text-xs font-mono select-none">—</span>
      );
    }

    const clean = val.trim();

    // Проверяем, является ли это двухбуквенным кодом страны (например, GB, US, FI, DE)
    if (isIsoCountryCode(clean)) {
      const countryRu = getCountryNameRu(clean);
      const flagUrl = getCountrySvgFlagUrl(clean);

      return (
        <div className="flex items-center gap-2 py-0.5 select-none">
          {/* Флаг SVG без обводки просто на фоне */}
          <img
            src={flagUrl}
            alt={clean}
            className="w-5 h-3.5 object-cover shrink-0 select-none"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <span className="text-white font-medium text-xs tracking-wide">
            {countryRu}
          </span>
          <span className="text-slate-500 font-mono text-[11px]">
            ({clean.toUpperCase()})
          </span>
        </div>
      );
    }

    // Если это статус доступности (Yes/No)
    const upper = clean.toUpperCase();
    if (upper === 'YES' || upper === 'ДА') {
      return (
        <span className="text-emerald-400 font-semibold text-xs flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          {label?.toLowerCase().includes('captcha') ? 'Без капчи' : 'Доступен'}
        </span>
      );
    }

    if (upper === 'NO' || upper === 'НЕТ') {
      if (label?.toLowerCase().includes('captcha')) {
        return (
          <span className="text-emerald-400 font-semibold text-xs flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            Капчи нет
          </span>
        );
      }
      return (
        <span className="text-rose-400 font-semibold text-xs flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
          Недоступен
        </span>
      );
    }

    return (
      <span className="text-slate-300 font-mono text-xs">
        {clean}
      </span>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Шапка отчёта геолокации */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.02] backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Globe className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Геолокация сервисов и стримингов
              </h2>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed pl-10">
              Определение региона вашего IP-адреса в стриминговых сервисах и мировых базах данных GeoIP
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasSpeedtestData && onBackToSpeedtest && (
              <button
                onClick={onBackToSpeedtest}
                className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>К скорости</span>
              </button>
            )}

            <button
              onClick={handleCopyLink}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 active:scale-95"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedLink ? 'Ссылка скопирована' : 'Поделиться'}</span>
            </button>
          </div>
        </div>

        {/* Сводка параметров IP */}
        <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-white/[0.02]">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">IPv4 Адрес</div>
            <div className="text-sm font-bold text-white font-mono mt-0.5 truncate">
              {geoData.ip4 || '—'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02]">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Провайдер (ISP)</div>
            <div className="text-sm font-bold text-emerald-400 truncate mt-0.5" title={geoData.isp || ''}>
              {geoData.isp || 'Определяется'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02]">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Локация</div>
            <div className="text-sm font-bold text-white truncate mt-0.5">
              {geoData.city ? `${geoData.city}, ` : ''}{geoData.country || '—'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02]">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">IPv6 Адрес</div>
            <div className="text-sm font-bold text-slate-300 font-mono mt-0.5 truncate" title={geoData.ip6 || ''}>
              {geoData.ip6 || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Панель фильтров и поиска */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Вкладки категорий */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.02] overflow-x-auto">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              filterCategory === 'all' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Все сервисы ({allItems.length})</span>
          </button>

          <button
            onClick={() => setFilterCategory('custom')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              filterCategory === 'custom' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Стриминги и сервисы ({customCount})</span>
          </button>

          <button
            onClick={() => setFilterCategory('primary')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              filterCategory === 'primary' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Базы GeoIP ({primaryCount})</span>
          </button>

          <button
            onClick={() => setFilterCategory('cdn')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              filterCategory === 'cdn' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>CDN ({cdnCount})</span>
          </button>
        </div>

        {/* Поиск */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск сервиса..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white/[0.03] focus:bg-white/[0.06] text-white text-xs placeholder:text-slate-500 outline-none transition-colors"
          />
        </div>
      </div>

      {/* Таблица / Список сервисов без обводок просто на фоне */}
      <div className="rounded-3xl bg-white/[0.015] overflow-hidden p-2 sm:p-3">
        {/* Заголовок таблицы */}
        <div className="grid grid-cols-12 gap-3 px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          <div className="col-span-5 sm:col-span-4">Сервис / Платформа</div>
          <div className="col-span-7 sm:col-span-4">IPv4 Регион</div>
          <div className="hidden sm:block sm:col-span-4">IPv6 Регион</div>
        </div>

        {/* Строки сервисов */}
        <div className="space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Сервисы не найдены по запросу «{searchQuery}»
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={`${item.service}-${idx}`}
                className="grid grid-cols-12 gap-3 px-4 py-3 rounded-2xl hover:bg-white/[0.03] transition-colors items-center"
              >
                {/* Название сервиса */}
                <div className="col-span-5 sm:col-span-4 flex items-center gap-2.5 min-w-0">
                  <span className="text-sm font-semibold text-white truncate">
                    {item.service}
                  </span>
                </div>

                {/* IPv4 */}
                <div className="col-span-7 sm:col-span-4 min-w-0">
                  {renderValueBadge(item.ipv4, item.service)}
                </div>

                {/* IPv6 */}
                <div className="hidden sm:block sm:col-span-4 min-w-0">
                  {renderValueBadge(item.ipv6, item.service)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Футер с пояснением */}
      <div className="px-4 py-3 text-center text-xs text-slate-500">
        Данные сформированы в результате параллельного тестирования сервисом ipregion
      </div>
    </div>
  );
};
