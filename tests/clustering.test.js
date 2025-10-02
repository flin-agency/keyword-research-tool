const clustering = require('../backend/services/clustering');

describe('Clustering Module', () => {
  describe('clusterKeywords', () => {
    test('should cluster keywords into groups', () => {
      const mockKeywords = [
        { keyword: 'web development', searchVolume: 10000, competition: 'medium', cpc: 2.5, cpcHigh: 5.0 },
        { keyword: 'web design', searchVolume: 8000, competition: 'low', cpc: 2.0, cpcHigh: 4.0 },
        { keyword: 'frontend development', searchVolume: 5000, competition: 'medium', cpc: 3.0, cpcHigh: 6.0 },
        { keyword: 'backend development', searchVolume: 4000, competition: 'high', cpc: 3.5, cpcHigh: 7.0 },
        { keyword: 'seo services', searchVolume: 12000, competition: 'high', cpc: 5.0, cpcHigh: 10.0 },
        { keyword: 'seo optimization', searchVolume: 9000, competition: 'medium', cpc: 4.0, cpcHigh: 8.0 },
        { keyword: 'digital marketing', searchVolume: 15000, competition: 'high', cpc: 6.0, cpcHigh: 12.0 },
        { keyword: 'content marketing', searchVolume: 7000, competition: 'medium', cpc: 3.0, cpcHigh: 6.0 },
      ];

      const clusters = clustering.clusterKeywords(mockKeywords);

      expect(Array.isArray(clusters)).toBe(true);
      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.length).toBeLessThanOrEqual(15);

      clusters.forEach((cluster) => {
        expect(cluster).toHaveProperty('id');
        expect(cluster).toHaveProperty('pillarTopic');
        expect(cluster).toHaveProperty('keywords');
        expect(cluster).toHaveProperty('totalSearchVolume');
        expect(cluster).toHaveProperty('avgCompetition');
        expect(cluster).toHaveProperty('clusterValueScore');
      });
    });

    test('should handle small keyword sets', () => {
      const mockKeywords = [
        { keyword: 'test', searchVolume: 1000, competition: 'low', cpc: 1.0, cpcHigh: 2.0 },
        { keyword: 'testing', searchVolume: 800, competition: 'low', cpc: 1.2, cpcHigh: 2.4 },
      ];

      const clusters = clustering.clusterKeywords(mockKeywords);

      expect(clusters.length).toBe(1);
      expect(clusters[0].keywords.length).toBe(2);
    });

    test('should sort clusters by value score', () => {
      const mockKeywords = Array.from({ length: 30 }, (_, i) => ({
        keyword: `keyword ${i}`,
        searchVolume: Math.floor(Math.random() * 10000),
        competition: ['low', 'medium', 'high'][i % 3],
        cpc: Math.random() * 5,
        cpcHigh: Math.random() * 10,
      }));

      const clusters = clustering.clusterKeywords(mockKeywords);

      for (let i = 0; i < clusters.length - 1; i++) {
        expect(clusters[i].clusterValueScore).toBeGreaterThanOrEqual(
          clusters[i + 1].clusterValueScore
        );
      }
    });
  });

  describe('calculateAvgCompetition', () => {
    test('should calculate average competition as low', () => {
      const keywords = [
        { competition: 'low' },
        { competition: 'low' },
        { competition: 'medium' },
      ];

      const avg = clustering.calculateAvgCompetition(keywords);
      expect(avg).toBe('low');
    });

    test('should calculate average competition as medium', () => {
      const keywords = [
        { competition: 'low' },
        { competition: 'medium' },
        { competition: 'high' },
      ];

      const avg = clustering.calculateAvgCompetition(keywords);
      expect(avg).toBe('medium');
    });

    test('should calculate average competition as high', () => {
      const keywords = [
        { competition: 'high' },
        { competition: 'high' },
        { competition: 'medium' },
      ];

      const avg = clustering.calculateAvgCompetition(keywords);
      expect(avg).toBe('high');
    });
  });

  describe('calculateClusterValue', () => {
    test('should calculate cluster value score', () => {
      const keywords = [
        { keyword: 'test', searchVolume: 10000, competition: 'low' },
        { keyword: 'testing', searchVolume: 8000, competition: 'low' },
        { keyword: 'test suite', searchVolume: 5000, competition: 'medium' },
      ];

      const score = clustering.calculateClusterValue(keywords);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('should favor high volume and low competition', () => {
      const highValueKeywords = [
        { keyword: 'test', searchVolume: 50000, competition: 'low' },
        { keyword: 'testing', searchVolume: 40000, competition: 'low' },
      ];

      const lowValueKeywords = [
        { keyword: 'test', searchVolume: 100, competition: 'high' },
        { keyword: 'testing', searchVolume: 80, competition: 'high' },
      ];

      const highScore = clustering.calculateClusterValue(highValueKeywords);
      const lowScore = clustering.calculateClusterValue(lowValueKeywords);

      expect(highScore).toBeGreaterThan(lowScore);
    });
  });

  describe('calculateSimilarity', () => {
    test('should calculate similarity between identical keywords', () => {
      const similarity = clustering.calculateSimilarity('web development', 'web development');
      expect(similarity).toBe(1);
    });

    test('should calculate similarity between related keywords', () => {
      const similarity = clustering.calculateSimilarity('web development', 'web design');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    test('should calculate low similarity between unrelated keywords', () => {
      const similarity = clustering.calculateSimilarity('web development', 'car insurance');
      expect(similarity).toBeLessThan(0.5);
    });
  });

  describe('vectorizeKeywords', () => {
    test('should vectorize keywords', () => {
      const keywords = [
        { keyword: 'web development' },
        { keyword: 'web design' },
        { keyword: 'mobile development' },
      ];

      const vectors = clustering.vectorizeKeywords(keywords);

      expect(Array.isArray(vectors)).toBe(true);
      expect(vectors.length).toBe(keywords.length);
      expect(Array.isArray(vectors[0])).toBe(true);
    });

    test('should create vectors of same length', () => {
      const keywords = [
        { keyword: 'test' },
        { keyword: 'testing framework' },
        { keyword: 'unit test suite' },
      ];

      const vectors = clustering.vectorizeKeywords(keywords);

      const lengths = vectors.map((v) => v.length);
      expect(new Set(lengths).size).toBe(1); // All vectors same length
    });
  });
});
