const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const MAX_PAGES = parseInt(process.env.MAX_PAGES_TO_SCAN) || 20;

/**
 * Scrape website content
 */
async function scrapeWebsite(url) {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 10000,
    });
  } catch (error) {
    throw new Error(`Failed to launch browser: ${error.message}`);
  }

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );

    const visitedUrls = new Set();
    const pagesToVisit = [url];
    const scrapedContent = {
      pages: [],
      totalWords: 0,
    };

    while (pagesToVisit.length > 0 && visitedUrls.size < MAX_PAGES) {
      const currentUrl = pagesToVisit.shift();

      if (visitedUrls.has(currentUrl)) continue;
      visitedUrls.add(currentUrl);

      try {
        console.log(`Scraping: ${currentUrl}`);
        await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        const html = await page.content();
        const pageData = extractContentFromHTML(html, currentUrl);
        scrapedContent.pages.push(pageData);
        scrapedContent.totalWords += pageData.wordCount;

        // Find internal links (only on first page to avoid deep crawling)
        if (visitedUrls.size === 1) {
          const links = await page.$$eval('a[href]', (anchors, baseUrl) => {
            return anchors
              .map((a) => {
                try {
                  const href = a.getAttribute('href');
                  if (!href) return null;
                  const fullUrl = new URL(href, baseUrl);
                  return fullUrl.href;
                } catch {
                  return null;
                }
              })
              .filter((link) => link !== null);
          }, url);

          // Filter for same-domain links
          const baseDomain = new URL(url).hostname;
          const internalLinks = links.filter((link) => {
            try {
              return new URL(link).hostname === baseDomain;
            } catch {
              return false;
            }
          });

          pagesToVisit.push(...internalLinks.slice(0, MAX_PAGES - 1));
        }
      } catch (error) {
        console.error(`Error scraping ${currentUrl}:`, error.message);
      }
    }

    return scrapedContent;
  } catch (error) {
    throw new Error(`Scraping error: ${error.message}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

/**
 * Extract content from HTML
 */
function extractContentFromHTML(html, url) {
  const $ = cheerio.load(html);

  // Remove script, style, and other non-content elements
  $('script, style, nav, footer, header, iframe, noscript').remove();

  const content = {
    url,
    title: $('title').text().trim(),
    metaDescription: $('meta[name="description"]').attr('content') || '',
    headings: {
      h1: [],
      h2: [],
      h3: [],
    },
    paragraphs: [],
    links: [],
    images: [],
    wordCount: 0,
  };

  // Extract headings
  $('h1').each((_, el) => {
    const text = $(el).text().trim();
    if (text) content.headings.h1.push(text);
  });

  $('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text) content.headings.h2.push(text);
  });

  $('h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text) content.headings.h3.push(text);
  });

  // Extract paragraphs
  $('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.split(/\s+/).length > 5) {
      // Only include substantial paragraphs
      content.paragraphs.push(text);
    }
  });

  // Extract link anchor text
  $('a').each((_, el) => {
    const text = $(el).text().trim();
    if (text) content.links.push(text);
  });

  // Extract image alt text
  $('img[alt]').each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt) content.images.push(alt);
  });

  // Calculate word count
  const allText = [
    content.title,
    content.metaDescription,
    ...content.headings.h1,
    ...content.headings.h2,
    ...content.headings.h3,
    ...content.paragraphs,
    ...content.links,
    ...content.images,
  ].join(' ');

  content.wordCount = allText.split(/\s+/).filter((w) => w.length > 0).length;

  return content;
}

/**
 * Validate if URL is accessible
 */
async function validateUrl(url) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  try {
    const page = await browser.newPage();
    const response = await page.goto(url, { timeout: 10000 });
    return response.ok();
  } catch (error) {
    return false;
  } finally {
    await browser.close();
  }
}

module.exports = {
  scrapeWebsite,
  validateUrl,
  extractContentFromHTML,
};
