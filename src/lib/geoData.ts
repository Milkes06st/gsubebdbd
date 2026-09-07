export interface GeoServiceItem {
  service: string;
  ipv4?: string | null;
  ipv6?: string | null;
  category?: 'custom' | 'primary' | 'cdn';
}

export interface SharedGeoData {
  ip4?: string;
  ip6?: string;
  isp?: string;
  city?: string;
  country?: string;
  date?: string;
  items?: GeoServiceItem[];
  results?: {
    custom?: GeoServiceItem[];
    primary?: GeoServiceItem[];
    cdn?: GeoServiceItem[];
  };
  custom?: GeoServiceItem[];
  primary?: GeoServiceItem[];
  cdn?: GeoServiceItem[];
}

let displayNamesRu: Intl.DisplayNames | null = null;
try {
  displayNamesRu = new Intl.DisplayNames(['ru'], { type: 'region' });
} catch {
  displayNamesRu = null;
}

/**
 * Возвращает русскоязычное название страны по ISO коду
 */
export function getCountryNameRu(code: string): string {
  if (!code) return '';
  const upper = code.toUpperCase();
  if (upper === 'WW') return 'Международный';
  if (upper === 'EU') return 'Евросоюз';
  if (upper === 'XK') return 'Косово';

  if (displayNamesRu) {
    try {
      const name = displayNamesRu.of(upper);
      if (name) return name;
    } catch {
      // fallback
    }
  }
  return upper;
}

/**
 * Проверяет, является ли строка двухбуквенным кодом страны
 */
export function isIsoCountryCode(val?: string | null): boolean {
  if (!val) return false;
  const clean = val.trim().toUpperCase();
  // Исключаем статусы "NO" и "NA"
  if (clean === 'NO' || clean === 'NA' || clean === 'N/A' || clean === 'YES') {
    return false;
  }
  return /^[A-Z]{2}$/.test(clean);
}

/**
 * Возвращает URL SVG флага страны без лишних обводок
 */
export function getCountrySvgFlagUrl(code: string): string {
  const clean = code.trim().toLowerCase();
  return `https://flagcdn.com/${clean}.svg`;
}

/**
 * Декодирует Base64 данные геолокации из URL
 */
export function decodeGeoBase64(base64Str: string): SharedGeoData | null {
  try {
    const cleanStr = base64Str.trim().replace(/\s+/g, '');
    let standardB64 = cleanStr.replace(/-/g, '+').replace(/_/g, '/');
    while (standardB64.length % 4 !== 0) {
      standardB64 += '=';
    }

    const binaryStr = atob(standardB64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const decodedText = new TextDecoder('utf-8').decode(bytes);
    const parsed = JSON.parse(decodedText);

    // Нормализуем структуру
    const normalized: SharedGeoData = {
      ip4: parsed.ip4 || parsed.ipv4 || parsed.ip || '',
      ip6: parsed.ip6 || parsed.ipv6 || '',
      isp: parsed.isp || '',
      city: parsed.city || '',
      country: parsed.country || '',
      date: parsed.date || '',
      items: []
    };

    const extractItems = (list: any[], cat: 'custom' | 'primary' | 'cdn'): GeoServiceItem[] => {
      if (!Array.isArray(list)) return [];
      return list.map(item => ({
        service: item.service || item.s || item.name || '',
        ipv4: item.ipv4 !== undefined ? item.ipv4 : (item.v4 !== undefined ? item.v4 : null),
        ipv6: item.ipv6 !== undefined ? item.ipv6 : (item.v6 !== undefined ? item.v6 : null),
        category: cat
      })).filter(it => it.service);
    };

    const customList = extractItems(parsed.results?.custom || parsed.custom || [], 'custom');
    const primaryList = extractItems(parsed.results?.primary || parsed.primary || [], 'primary');
    const cdnList = extractItems(parsed.results?.cdn || parsed.cdn || [], 'cdn');

    normalized.custom = customList;
    normalized.primary = primaryList;
    normalized.cdn = cdnList;
    normalized.items = [...customList, ...primaryList, ...cdnList];

    return normalized;
  } catch (err) {
    console.error('Ошибка декодирования Geo Base64:', err);
    return null;
  }
}

/**
 * Кодирует данные геолокации в URL-safe base64
 */
export function encodeGeoBase64(data: SharedGeoData): string {
  try {
    const compactObj = {
      ip4: data.ip4 || '',
      ip6: data.ip6 || '',
      isp: data.isp || '',
      city: data.city || '',
      country: data.country || '',
      date: data.date || '',
      custom: (data.custom || []).map(i => ({ s: i.service, v4: i.ipv4, v6: i.ipv6 })),
      primary: (data.primary || []).map(i => ({ s: i.service, v4: i.ipv4, v6: i.ipv6 })),
      cdn: (data.cdn || []).map(i => ({ s: i.service, v4: i.ipv4, v6: i.ipv6 }))
    };

    const jsonStr = JSON.stringify(compactObj);
    const bytes = new TextEncoder().encode(jsonStr);
    let binaryStr = '';
    for (let i = 0; i < bytes.length; i++) {
      binaryStr += String.fromCharCode(bytes[i]);
    }
    return btoa(binaryStr)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (err) {
    console.error('Ошибка кодирования Geo Base64:', err);
    return '';
  }
}
