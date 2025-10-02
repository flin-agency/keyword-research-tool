const { GoogleAdsApi } = require('google-ads-api');

const MAX_KEYWORDS = parseInt(process.env.MAX_KEYWORDS) || 500;
const MIN_SEARCH_VOLUME = parseInt(process.env.MIN_SEARCH_VOLUME) || 10;

let client = null;

/**
 * Initialize Google Ads API client
 */
function initializeClient() {
  if (client) return client;

  const config = {
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  };

  // Check if all required credentials are present
  if (
    !config.developer_token ||
    !config.client_id ||
    !config.client_secret ||
    !config.refresh_token
  ) {
    throw new Error('Google Ads API credentials not configured');
  }

  client = new GoogleAdsApi(config);
  return client;
}

/**
 * Get keyword metrics from Google Ads API with country-specific search volumes
 */
async function getKeywordMetrics(seedKeywords, country = '2756', languageCode = null) {
  try {
    const adsClient = initializeClient();
    const customerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

    if (!customerId) {
      throw new Error('GOOGLE_ADS_LOGIN_CUSTOMER_ID not configured');
    }

    const customer = adsClient.Customer({ customer_id: customerId });

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

    console.log(`[Google Ads] Using country ${country} with language ${selectedLanguage} for accurate search volumes`);

    for (let i = 0; i < seedKeywords.length; i += batchSize) {
      const batch = seedKeywords.slice(i, i + batchSize);

      const ideas = await customer.keywordPlanIdeaService.generateKeywordIdeas({
        customer_id: customerId,
        keyword_seed: {
          keywords: batch,
        },
        geo_target_constants: [`geoTargetConstants/${country}`],
        language: { language_constant: language },
        include_adult_keywords: false,
      });

      ideas.forEach((idea) => {
        const keyword = idea.text;
        const metrics = idea.keyword_idea_metrics;

        if (metrics.avg_monthly_searches >= MIN_SEARCH_VOLUME) {
          allKeywordData.push({
            keyword,
            searchVolume: metrics.avg_monthly_searches || 0,
            competition: mapCompetition(metrics.competition),
            cpc: metrics.low_top_of_page_bid_micros
              ? metrics.low_top_of_page_bid_micros / 1000000
              : 0,
            cpcHigh: metrics.high_top_of_page_bid_micros
              ? metrics.high_top_of_page_bid_micros / 1000000
              : 0,
          });
        }
      });

      if (allKeywordData.length >= MAX_KEYWORDS) break;
    }

    return allKeywordData.slice(0, MAX_KEYWORDS);
  } catch (error) {
    console.error('Google Ads API error:', error);
    throw error;
  }
}

/**
 * Map competition level from API
 */
function mapCompetition(competition) {
  const competitionMap = {
    0: 'unknown',
    1: 'low',
    2: 'medium',
    3: 'high',
  };
  return competitionMap[competition] || 'unknown';
}

/**
 * Generate mock keyword data (for testing without API)
 */
function getMockKeywordData(seedKeywords) {
  const mockData = [];

  seedKeywords.forEach((keyword) => {
    // Base keyword
    const baseCpc = parseFloat((Math.random() * 5 + 0.5).toFixed(2));
    const baseCpcHigh = parseFloat((baseCpc + Math.random() * 4 + 2).toFixed(2));

    mockData.push({
      keyword,
      searchVolume: Math.floor(Math.random() * 10000) + 100,
      competition: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      cpc: baseCpc,
      cpcHigh: baseCpcHigh,
    });

    // Add related variations (1-3 per seed keyword)
    const variations = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < variations; i++) {
      const suffixes = [
        'guide',
        'tips',
        'best',
        'how to',
        'tutorial',
        'free',
        'online',
        '2024',
        'for beginners',
        'services',
      ];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

      const cpcLow = parseFloat((Math.random() * 4 + 0.3).toFixed(2));
      const cpcHigh = parseFloat((cpcLow + Math.random() * 3 + 1).toFixed(2));

      mockData.push({
        keyword: `${keyword} ${suffix}`,
        searchVolume: Math.floor(Math.random() * 5000) + 50,
        competition: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        cpc: cpcLow,
        cpcHigh: cpcHigh,
      });
    }
  });

  return mockData.slice(0, MAX_KEYWORDS);
}

module.exports = {
  getKeywordMetrics,
  getMockKeywordData,
  initializeClient,
};
