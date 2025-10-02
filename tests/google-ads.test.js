const googleAds = require('../backend/services/google-ads');

describe('Google Ads Module', () => {
  describe('getMockKeywordData', () => {
    test('should generate mock data for seed keywords', () => {
      const seedKeywords = ['web development', 'seo services', 'digital marketing'];

      const mockData = googleAds.getMockKeywordData(seedKeywords);

      expect(Array.isArray(mockData)).toBe(true);
      expect(mockData.length).toBeGreaterThan(seedKeywords.length);

      mockData.forEach((keyword) => {
        expect(keyword).toHaveProperty('keyword');
        expect(keyword).toHaveProperty('searchVolume');
        expect(keyword).toHaveProperty('competition');
        expect(keyword).toHaveProperty('cpc');
        expect(keyword).toHaveProperty('cpcHigh');

        expect(typeof keyword.keyword).toBe('string');
        expect(typeof keyword.searchVolume).toBe('number');
        expect(['low', 'medium', 'high']).toContain(keyword.competition);
        expect(typeof keyword.cpc).toBe('number');
        expect(typeof keyword.cpcHigh).toBe('number');

        expect(keyword.searchVolume).toBeGreaterThan(0);
        expect(keyword.cpc).toBeGreaterThan(0);
        expect(keyword.cpcHigh).toBeGreaterThanOrEqual(keyword.cpc);
      });
    });

    test('should include original seed keywords', () => {
      const seedKeywords = ['test keyword', 'another keyword'];

      const mockData = googleAds.getMockKeywordData(seedKeywords);

      const keywords = mockData.map((d) => d.keyword);
      seedKeywords.forEach((seed) => {
        expect(keywords).toContain(seed);
      });
    });

    test('should respect MAX_KEYWORDS limit', () => {
      const seedKeywords = Array.from({ length: 200 }, (_, i) => `keyword ${i}`);

      const mockData = googleAds.getMockKeywordData(seedKeywords);

      expect(mockData.length).toBeLessThanOrEqual(500);
    });

    test('should generate related keyword variations', () => {
      const seedKeywords = ['web development'];

      const mockData = googleAds.getMockKeywordData(seedKeywords);

      const variations = mockData.filter((kw) => kw.keyword.includes('web development'));
      expect(variations.length).toBeGreaterThan(1);
    });
  });

  describe('initializeClient', () => {
    test('should throw error if credentials not configured', () => {
      // Save original env vars
      const originalEnv = { ...process.env };

      // Clear credentials
      delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
      delete process.env.GOOGLE_ADS_CLIENT_ID;
      delete process.env.GOOGLE_ADS_CLIENT_SECRET;
      delete process.env.GOOGLE_ADS_REFRESH_TOKEN;

      expect(() => {
        googleAds.initializeClient();
      }).toThrow('Google Ads API credentials not configured');

      // Restore env vars
      process.env = originalEnv;
    });
  });
});
