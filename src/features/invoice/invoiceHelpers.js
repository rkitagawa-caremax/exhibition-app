export const getMakerValue = (maker, key) => {
  if (maker?.response && maker.response[key] !== undefined && maker.response[key] !== '') return maker.response[key];
  if (maker && maker[key] !== undefined && maker[key] !== '') return maker[key];
  return null;
};

export const formatJapaneseDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

export const formatJapaneseMonthEnd = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月末日`;
};

export const getFirstEventDate = (dates) => {
  if (!Array.isArray(dates) || dates.length === 0) return null;
  const sorted = [...dates].filter(Boolean).sort();
  if (sorted.length === 0) return null;
  const parsed = new Date(`${sorted[0]}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getMonthEndByOffset = (baseDate, monthOffset) => {
  if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) return null;
  return new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset + 1, 0);
};

export const resolveInvoiceSheetName = (paymentMethod) => {
  const normalized = String(paymentMethod || '').replace(/\s+/g, '');
  return normalized.includes('相殺') ? '相殺' : '振込';
};

export const sanitizeFileName = (value, fallback) => {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
  return cleaned || fallback;
};

export const formatDateCompact = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

export const withTimeout = (promise, timeoutMs, message) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
};
