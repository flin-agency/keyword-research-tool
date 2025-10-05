const axios = require('axios');
const { google } = require('googleapis');

const MAX_KEYWORDS = parseInt(process.env.MAX_KEYWORDS) || 500;
const MIN_SEARCH_VOLUME = parseInt(process.env.MIN_SEARCH_VOLUME) || 10;

let oauth2Client = null;
let accessToken = null;
let tokenExpiry = null;

/**
 * Initialize OAuth2 client and get access token
 */
async function getAccessToken() {
  // Return cached token if still valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  if (!oauth2Client) {
    oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_ADS_CLIENT_ID,
      process.env.GOOGLE_ADS_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    });
  }

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    accessToken = credentials.access_token;
    tokenExpiry = credentials.expiry_date;

    console.log('[Google Ads REST] Access token refreshed successfully');
    return accessToken;
  } catch (error) {
    console.error('[Google Ads REST] Token refresh error:', error);
    throw new Error('Failed to refresh Google Ads access token');
  }
}

/**
 * Get keyword metrics from Google Ads API using REST
 */
async function getKeywordMetrics(seedKeywords, country = '2756', languageCode = null) {
  try {
    const customerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    if (!customerId || !developerToken) {
      throw new Error('Google Ads API credentials not configured');
    }

    const token = await getAccessToken();

    // Batch keywords to avoid API limits
    const batchSize = 50;
    const allKeywordData = [];

    // Language constants mapping
    const languageMap = {
      'de': 'languageConstants/1001', // German
      'en': 'languageConstants/1000', // English
      'fr': 'languageConstants/1002', // French
      'it': 'languageConstants/1004', // Italian
      'es': 'languageConstants/1003', // Spanish
      'nl': 'languageConstants/1010', // Dutch
      'pt': 'languageConstants/1014', // Portuguese
      'pl': 'languageConstants/1025', // Polish
      'ru': 'languageConstants/1031', // Russian
      'ja': 'languageConstants/1005', // Japanese
      'zh': 'languageConstants/1017', // Chinese
    };

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
    const language = languageMap[selectedLanguage] || 'languageConstants/1000';

    console.log(`[Google Ads REST] Using country ${country} with language ${selectedLanguage} for accurate search volumes`);

    for (let i = 0; i < seedKeywords.length; i += batchSize) {
      const batch = seedKeywords.slice(i, i + batchSize);

      const requestBody = {
        keywordSeed: {
          keywords: batch,
        },
        geoTargetConstants: [`geoTargetConstants/${country}`],
        language,
        includeAdultKeywords: false,
        keywordPlanNetwork: 'GOOGLE_SEARCH',
      };

      const url = `https://googleads.googleapis.com/v17/customers/${customerId}:generateKeywordIdeas`;

      console.log(`[Google Ads REST] Calling API for batch ${i / batchSize + 1}`);

      const response = await axios.post(url, requestBody, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
      });

      if (response.data && response.data.results) {
        response.data.results.forEach((idea) => {
          const keyword = idea.text;
          const metrics = idea.keywordIdeaMetrics;

          if (metrics && metrics.avgMonthlySearches >= MIN_SEARCH_VOLUME) {
            allKeywordData.push({
              keyword,
              searchVolume: parseInt(metrics.avgMonthlySearches) || 0,
              competition: mapCompetition(metrics.competition),
              cpc: metrics.lowTopOfPageBidMicros
                ? metrics.lowTopOfPageBidMicros / 1000000
                : 0,
              cpcHigh: metrics.highTopOfPageBidMicros
                ? metrics.highTopOfPageBidMicros / 1000000
                : 0,
            });
          }
        });
      }

      if (allKeywordData.length >= MAX_KEYWORDS) break;
    }

    console.log(`[Google Ads REST] Successfully retrieved ${allKeywordData.length} keywords`);
    return allKeywordData.slice(0, MAX_KEYWORDS);
  } catch (error) {
    console.error('[Google Ads REST] API error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Map competition level from API
 */
function mapCompetition(competition) {
  const competitionMap = {
    'UNSPECIFIED': 'unknown',
    'UNKNOWN': 'unknown',
    'LOW': 'low',
    'MEDIUM': 'medium',
    'HIGH': 'high',
  };
  return competitionMap[competition] || 'unknown';
}

module.exports = {
  getKeywordMetrics,
};
