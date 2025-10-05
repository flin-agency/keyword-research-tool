const axios = require('axios');

const MAX_KEYWORDS = parseInt(process.env.MAX_KEYWORDS) || 500;
const MIN_SEARCH_VOLUME = parseInt(process.env.MIN_SEARCH_VOLUME) || 10;
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';

/**
 * Get keyword metrics from Python microservice
 */
async function getKeywordMetrics(seedKeywords, country = '2756', languageCode = null) {
  try {
    // Default language based on country if not specified
    const defaultLanguageByCountry = {
      '2756': 'de', // Switzerland - German
      '2276': 'de', // Germany - German
      '2040': 'de', // Austria - German
      '2250': 'fr', // France - French
      '2380': 'it', // Italy - Italian
      '2826': 'en', // UK - English
      '2840': 'en', // US - English
      '2124': 'en', // Canada - English
      '2528': 'nl', // Netherlands - Dutch
      '2056': 'nl', // Belgium - Dutch
      '2724': 'es', // Spain - Spanish
    };

    const selectedLanguage = languageCode || defaultLanguageByCountry[country] || 'en';

    console.log(`[Google Ads Python] Calling Python service for ${seedKeywords.length} keywords, country ${country}, language ${selectedLanguage}`);

    const response = await axios.post(`${PYTHON_SERVICE_URL}/generate-keyword-ideas`, {
      keywords: seedKeywords,
      country,
      language: selectedLanguage,
    }, {
      timeout: 120000, // 2 minute timeout
    });

    if (response.data && response.data.success && response.data.keywords) {
      console.log(`[Google Ads Python] Successfully retrieved ${response.data.keywords.length} keywords`);
      return response.data.keywords;
    } else {
      throw new Error('Invalid response from Python service');
    }
  } catch (error) {
    console.error('[Google Ads Python] Error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  getKeywordMetrics,
};
