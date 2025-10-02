const exporter = require('../backend/services/exporter');

describe('Exporter Module', () => {
  describe('toCSV', () => {
    test('should export data to CSV format', () => {
      const mockData = {
        clusters: [
          {
            id: 1,
            pillarTopic: 'web development',
            keywords: [
              {
                keyword: 'web development',
                searchVolume: 10000,
                competition: 'medium',
                cpc: 2.5,
                cpcHigh: 5.0,
              },
              {
                keyword: 'web design',
                searchVolume: 8000,
                competition: 'low',
                cpc: 2.0,
                cpcHigh: 4.0,
              },
            ],
            totalSearchVolume: 18000,
            clusterValueScore: 75.5,
          },
          {
            id: 2,
            pillarTopic: 'seo services',
            keywords: [
              {
                keyword: 'seo services',
                searchVolume: 12000,
                competition: 'high',
                cpc: 5.0,
                cpcHigh: 10.0,
              },
            ],
            totalSearchVolume: 12000,
            clusterValueScore: 65.3,
          },
        ],
      };

      const csv = exporter.toCSV(mockData);

      expect(typeof csv).toBe('string');
      expect(csv).toContain('Cluster ID');
      expect(csv).toContain('Pillar Topic');
      expect(csv).toContain('Keyword');
      expect(csv).toContain('Search Volume');
      expect(csv).toContain('Competition');
      expect(csv).toContain('web development');
      expect(csv).toContain('seo services');
    });

    test('should handle empty clusters', () => {
      const mockData = {
        clusters: [],
      };

      const csv = exporter.toCSV(mockData);

      expect(typeof csv).toBe('string');
      expect(csv).toContain('Cluster ID'); // Headers should still be present
    });

    test('should format cluster value score to 2 decimals', () => {
      const mockData = {
        clusters: [
          {
            id: 1,
            pillarTopic: 'test',
            keywords: [
              {
                keyword: 'test',
                searchVolume: 1000,
                competition: 'low',
                cpc: 1.0,
                cpcHigh: 2.0,
              },
            ],
            totalSearchVolume: 1000,
            clusterValueScore: 75.123456,
          },
        ],
      };

      const csv = exporter.toCSV(mockData);

      expect(csv).toContain('75.12');
      expect(csv).not.toContain('75.123456');
    });

    test('should include all keywords from all clusters', () => {
      const mockData = {
        clusters: [
          {
            id: 1,
            pillarTopic: 'topic1',
            keywords: [
              { keyword: 'keyword1', searchVolume: 100, competition: 'low', cpc: 1, cpcHigh: 2 },
              { keyword: 'keyword2', searchVolume: 200, competition: 'medium', cpc: 2, cpcHigh: 3 },
            ],
            totalSearchVolume: 300,
            clusterValueScore: 50,
          },
          {
            id: 2,
            pillarTopic: 'topic2',
            keywords: [
              { keyword: 'keyword3', searchVolume: 300, competition: 'high', cpc: 3, cpcHigh: 4 },
            ],
            totalSearchVolume: 300,
            clusterValueScore: 40,
          },
        ],
      };

      const csv = exporter.toCSV(mockData);

      expect(csv).toContain('keyword1');
      expect(csv).toContain('keyword2');
      expect(csv).toContain('keyword3');

      // Should have 3 data rows + 1 header row
      const rows = csv.split('\n').filter((row) => row.trim().length > 0);
      expect(rows.length).toBe(4);
    });
  });
});
