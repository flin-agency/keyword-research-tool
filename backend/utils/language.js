const DEFAULT_LANGUAGE_BY_COUNTRY = {
  '2756': 'de', // Switzerland
  '2276': 'de', // Germany
  '2040': 'de', // Austria
  '2250': 'fr', // France
  '2380': 'it', // Italy
  '2826': 'en', // United Kingdom
  '2840': 'en', // United States
  '2124': 'en', // Canada
  '2528': 'nl', // Netherlands
  '2056': 'nl', // Belgium
  '2724': 'es', // Spain
};

const LANGUAGE_ALIASES = {
  en: 'en',
  english: 'en',
  'en-us': 'en',
  'en-gb': 'en',

  de: 'de',
  german: 'de',
  deutsch: 'de',
  'de-de': 'de',
  'de-ch': 'de',

  fr: 'fr',
  french: 'fr',
  français: 'fr',

  it: 'it',
  italian: 'it',
  italiano: 'it',

  es: 'es',
  spanish: 'es',
  español: 'es',

  nl: 'nl',
  dutch: 'nl',
  nederlands: 'nl',

  pt: 'pt',
  portuguese: 'pt',
  português: 'pt',

  pl: 'pl',
  polish: 'pl',
  polski: 'pl',

  ru: 'ru',
  russian: 'ru',
  русский: 'ru',

  ja: 'ja',
  japanese: 'ja',
  日本語: 'ja',

  zh: 'zh',
  chinese: 'zh',
  中文: 'zh',
};

const AUTO_LANGUAGE_VALUES = new Set(['auto', 'automatic', 'default', 'system']);

function getDefaultLanguageForCountry(countryCode) {
  if (!countryCode) {
    return 'en';
  }
  return DEFAULT_LANGUAGE_BY_COUNTRY[countryCode] || 'en';
}

function normalizeLanguage(requestedLanguage) {
  if (!requestedLanguage || typeof requestedLanguage !== 'string') {
    return null;
  }

  const normalized = requestedLanguage.trim().toLowerCase();
  if (!normalized || AUTO_LANGUAGE_VALUES.has(normalized)) {
    return null;
  }

  // Support language-region codes like de-CH by checking alias map
  if (LANGUAGE_ALIASES[normalized]) {
    return LANGUAGE_ALIASES[normalized];
  }

  // Fall back to primary language code if it's a language-region pattern
  if (normalized.includes('-')) {
    const [base] = normalized.split('-');
    if (LANGUAGE_ALIASES[base]) {
      return LANGUAGE_ALIASES[base];
    }
  }

  // Return normalized two-letter code if it looks valid
  if (/^[a-z]{2}$/.test(normalized)) {
    return normalized;
  }

  return null;
}

function resolveLanguage(requestedLanguage, countryCode) {
  const normalized = normalizeLanguage(requestedLanguage);
  if (normalized) {
    return normalized;
  }
  return getDefaultLanguageForCountry(countryCode);
}

module.exports = {
  DEFAULT_LANGUAGE_BY_COUNTRY,
  LANGUAGE_ALIASES,
  AUTO_LANGUAGE_VALUES,
  getDefaultLanguageForCountry,
  normalizeLanguage,
  resolveLanguage,
};
