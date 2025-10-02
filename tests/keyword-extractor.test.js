const keywordExtractor = require('../backend/services/keyword-extractor');

describe('Keyword Extractor Module', () => {
  describe('extractKeywords', () => {
    test('should extract keywords from scraped content', () => {
      const mockContent = {
        pages: [
          {
            title: 'Web Development Services',
            metaDescription: 'Professional web development and design',
            headings: {
              h1: ['Web Development'],
              h2: ['Our Services', 'Portfolio'],
              h3: ['Frontend Development', 'Backend Development'],
            },
            paragraphs: [
              'We provide professional web development services including frontend and backend development',
              'Our team specializes in React, Node.js, and modern web technologies',
            ],
            links: ['Contact Us', 'View Portfolio'],
            images: ['Team working on laptops'],
            wordCount: 50,
          },
        ],
        totalWords: 50,
      };

      const keywords = keywordExtractor.extractKeywords(mockContent);

      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords.every((kw) => typeof kw === 'string')).toBe(true);
    });

    test('should limit keywords to 200', () => {
      const mockContent = {
        pages: [
          {
            title: 'Test',
            metaDescription: 'Test',
            headings: { h1: [], h2: [], h3: [] },
            paragraphs: Array(100).fill(
              'keyword test development web design frontend backend javascript react node python'
            ),
            links: [],
            images: [],
            wordCount: 1000,
          },
        ],
        totalWords: 1000,
      };

      const keywords = keywordExtractor.extractKeywords(mockContent);

      expect(keywords.length).toBeLessThanOrEqual(200);
    });
  });

  describe('extractSingleKeywords', () => {
    test('should extract nouns from text', () => {
      const texts = [
        'Web development is important for business',
        'Software engineering skills are essential for developers',
        'Web development services help companies grow',
      ];

      const keywords = keywordExtractor.extractSingleKeywords(texts);

      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeGreaterThan(0);
    });

    test('should filter out short words', () => {
      const texts = ['a b cd efg hijk'];

      const keywords = keywordExtractor.extractSingleKeywords(texts);

      // Words with less than 3 characters should be filtered out
      const shortWords = keywords.filter((kw) => kw.keyword.length < 3);
      expect(shortWords.length).toBe(0);
    });
  });

  describe('extractPhrases', () => {
    test('should extract 2-4 word phrases', () => {
      const texts = [
        'web development services for businesses',
        'web development services are important',
        'professional software engineering team',
        'professional software engineering skills',
      ];

      const phrases = keywordExtractor.extractPhrases(texts);

      expect(Array.isArray(phrases)).toBe(true);
      if (phrases.length > 0) {
        expect(phrases.some((p) => p.wordCount >= 2 && p.wordCount <= 4)).toBe(true);
      }
    });

    test('should require minimum frequency of 2', () => {
      const texts = [
        'web development',
        'web development',
        'software engineering',
        'unique phrase',
      ];

      const phrases = keywordExtractor.extractPhrases(texts);

      // 'unique phrase' appears only once and should be filtered out
      const uniquePhraseExists = phrases.some((p) => p.keyword === 'unique phrase');
      expect(uniquePhraseExists).toBe(false);
    });
  });

  describe('calculateRelevanceScore', () => {
    test('should calculate relevance score', () => {
      const keyword = {
        keyword: 'web development',
        frequency: 10,
        wordCount: 2,
        tfidfScore: 0.5,
      };

      const score = keywordExtractor.calculateRelevanceScore(keyword);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
    });

    test('should give bonus to multi-word phrases', () => {
      const singleWord = {
        keyword: 'web',
        frequency: 10,
        wordCount: 1,
        tfidfScore: 0.5,
      };

      const multiWord = {
        keyword: 'web development',
        frequency: 10,
        wordCount: 2,
        tfidfScore: 0.5,
      };

      const scoreSingle = keywordExtractor.calculateRelevanceScore(singleWord);
      const scoreMulti = keywordExtractor.calculateRelevanceScore(multiWord);

      expect(scoreMulti).toBeGreaterThan(scoreSingle);
    });
  });
});
