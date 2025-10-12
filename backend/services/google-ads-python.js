const axios = require('axios');
const { resolveLanguage } = require('../utils/language');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

/**
 * Get keyword metrics from Python microservice
 */
async function getKeywordMetrics(seedKeywords, country = '2756', languageCode = null) {
  try {
    const selectedLanguage = resolveLanguage(languageCode, country);

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
