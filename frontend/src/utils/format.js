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
