export function getLocale(language) {
  return language === 'en' ? 'en-US' : 'id-ID';
}

export function formatDate(date, options, language = 'id') {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString(getLocale(language), options);
  } catch {
    return '-';
  }
}

export function toDateOnly(date) {
  if (!date) return new Date().toISOString().split('T')[0];
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(date).slice(0, 10);
}

export function formatDateOnly(date, options, language = 'id') {
  if (!date) return '-';
  const match = String(date).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return formatDate(date, options, language);

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) {
    return '-';
  }
  return parsed.toLocaleDateString(getLocale(language), { ...options, timeZone: 'UTC' });
}

export function formatDateTime(date, options, language = 'id') {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleString(getLocale(language), options);
  } catch {
    return '-';
  }
}

export function formatNumber(value, language = 'id', options) {
  const num = Number(value);
  if (value === '' || value == null || Number.isNaN(num)) return '0';
  return num.toLocaleString(getLocale(language), options);
}

export function formatCompact(value, language = 'id', maximumFractionDigits = 1) {
  const num = Number(value) || 0;
  return Intl.NumberFormat(getLocale(language), { notation: 'compact', maximumFractionDigits }).format(num);
}

export function formatCurrency(value, language = 'id', compact = false) {
  const num = Number(value) || 0;
  if (language === 'en') {
    if (compact) return `IDR ${Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(num)}`;
    return `IDR ${num.toLocaleString('en-US')}`;
  }
  if (compact) return `Rp ${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 }).format(num)}`;
  return `Rp ${num.toLocaleString('id-ID')}`;
}

export function currencyPrefix(language = 'id') {
  return language === 'en' ? 'IDR' : 'Rp';
}
