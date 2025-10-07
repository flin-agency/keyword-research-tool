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

function getDefaultLanguageForCountry(countryCode) {
  if (!countryCode) {
    return 'en';
  }
  return DEFAULT_LANGUAGE_BY_COUNTRY[countryCode] || 'en';
}

function resolveLanguage(requestedLanguage, countryCode) {
  if (requestedLanguage && typeof requestedLanguage === 'string' && requestedLanguage.trim().length > 0) {
    return requestedLanguage.trim().toLowerCase();
  }
  return getDefaultLanguageForCountry(countryCode);
}

module.exports = {
  DEFAULT_LANGUAGE_BY_COUNTRY,
  getDefaultLanguageForCountry,
  resolveLanguage,
};
