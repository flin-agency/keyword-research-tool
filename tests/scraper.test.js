const scraper = require('../backend/services/scraper-unified');

describe('Unified Scraper Module', () => {
  describe('extractContentFromHTML', () => {
    test('should extract title from HTML', () => {
      const html = '<html><head><title>Test Page</title></head><body></body></html>';
      const result = scraper.extractContentFromHTML(html, 'http://test.com');

      expect(result.title).toBe('Test Page');
    });

    test('should extract meta description', () => {
      const html = `
        <html>
          <head><meta name="description" content="Test description"></head>
          <body></body>
        </html>
      `;
      const result = scraper.extractContentFromHTML(html, 'http://test.com');

      expect(result.metaDescription).toBe('Test description');
    });

    test('should extract headings', () => {
      const html = `
        <html>
          <body>
            <h1>Heading 1</h1>
            <h2>Heading 2</h2>
            <h3>Heading 3</h3>
          </body>
        </html>
      `;
      const result = scraper.extractContentFromHTML(html, 'http://test.com');

      expect(result.headings.h1).toContain('Heading 1');
      expect(result.headings.h2).toContain('Heading 2');
      expect(result.headings.h3).toContain('Heading 3');
    });

    test('should extract paragraphs', () => {
      const html = `
        <html>
          <body>
            <p>This is a test paragraph with more than five words</p>
            <p>Short</p>
          </body>
        </html>
      `;
      const result = scraper.extractContentFromHTML(html, 'http://test.com');

      expect(result.paragraphs.length).toBe(1);
      expect(result.paragraphs[0]).toContain('test paragraph');
    });

    test('should extract image alt text', () => {
      const html = '<html><body><img src="test.jpg" alt="Test image"></body></html>';
      const result = scraper.extractContentFromHTML(html, 'http://test.com');

      expect(result.images).toContain('Test image');
    });

    test('should calculate word count', () => {
      const html = `
        <html>
          <head><title>Test Title</title></head>
          <body>
            <p>This is a test with ten words in this paragraph</p>
          </body>
        </html>
      `;
      const result = scraper.extractContentFromHTML(html, 'http://test.com');

      expect(result.wordCount).toBeGreaterThan(0);
    });

    test('should remove script and style tags', () => {
      const html = `
        <html>
          <head><style>.test { color: red; }</style></head>
          <body>
            <script>console.log('test');</script>
            <p>Visible content here with more words to pass this scraper filter reliably today</p>
          </body>
        </html>
      `;
      const result = scraper.extractContentFromHTML(html, 'http://test.com');

      expect(result.paragraphs.length).toBeGreaterThan(0);
      expect(result.paragraphs[0]).toContain('Visible content here');
    });
  });
});
