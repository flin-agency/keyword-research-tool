const { chromium } = require('playwright');
const axios = require('axios');
const cheerio = require('cheerio');

const MAX_PAGES = parseInt(process.env.MAX_PAGES_TO_SCAN) || 20;
const TIMEOUT = 30000;

/**
 * Multi-strategy web scraper
 * Tries: 1) Playwright, 2) Axios+Cheerio, 3) Demo data fallback
 */
async function scrapeWebsite(url) {
  console.log(`[Scraper] Attempting to scrape: ${url}`);

  // Strategy 1: Try Playwright (handles JavaScript-heavy sites)
  try {
    return await scrapeWithPlaywright(url);
  } catch (error) {
    console.warn(`[Scraper] Playwright failed: ${error.message}`);
  }

  // Strategy 2: Try Axios + Cheerio (lighter, faster for static sites)
  try {
    return await scrapeWithAxios(url);
  } catch (error) {
    console.warn(`[Scraper] Axios failed: ${error.message}`);
  }

  // If all strategies fail, throw error (API will catch and use demo data)
  throw new Error('All scraping strategies failed');
}

/**
 * Scrape using Playwright (best for JavaScript-rendered content)
 */
async function scrapeWithPlaywright(url) {
  console.log('[Scraper] Using Playwright strategy');

  const browser = await chromium.launch({
    headless: true,
    timeout: 10000,
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Set timeout and error handling
    page.setDefaultTimeout(TIMEOUT);

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
        console.log(`[Scraper] Visiting: ${currentUrl}`);

        await page.goto(currentUrl, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT,
        });

        // Wait a bit for dynamic content
        await page.waitForTimeout(1000);

        const html = await page.content();
        const pageData = extractContentFromHTML(html, currentUrl);
        scrapedContent.pages.push(pageData);
        scrapedContent.totalWords += pageData.wordCount;

        // Find internal links (only on first page)
        if (visitedUrls.size === 1) {
          const links = await page.$$eval('a[href]', (anchors, baseUrl) => {
            return anchors
              .map((a) => {
                try {
                  const href = a.getAttribute('href');
                  if (!href || href.startsWith('#') || href.startsWith('mailto:'))
                    return null;
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
        console.warn(`[Scraper] Error on ${currentUrl}: ${error.message}`);
      }
    }

    console.log(
      `[Scraper] Playwright success: ${scrapedContent.pages.length} pages, ${scrapedContent.totalWords} words`
    );
    return scrapedContent;
  } finally {
    await browser.close();
  }
}

/**
 * Scrape using Axios + Cheerio (lightweight, static sites only)
 */
async function scrapeWithAxios(url) {
  console.log('[Scraper] Using Axios strategy');

  const scrapedContent = {
    pages: [],
    totalWords: 0,
  };

  try {
    const response = await axios.get(url, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      maxRedirects: 5,
    });

    const html = response.data;
    const pageData = extractContentFromHTML(html, url);
    scrapedContent.pages.push(pageData);
    scrapedContent.totalWords = pageData.wordCount;

    // Try to get a few more pages
    const $ = cheerio.load(html);
    const baseDomain = new URL(url).hostname;
    const links = [];

    $('a[href]').each((_, el) => {
      try {
        const href = $(el).attr('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
        const fullUrl = new URL(href, url);
        if (fullUrl.hostname === baseDomain && !links.includes(fullUrl.href)) {
          links.push(fullUrl.href);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    });

    // Fetch up to 4 more pages
    const additionalPages = links.slice(0, 4);
    for (const pageUrl of additionalPages) {
      try {
        const res = await axios.get(pageUrl, {
          timeout: 10000,
          headers: response.config.headers,
        });
        const data = extractContentFromHTML(res.data, pageUrl);
        scrapedContent.pages.push(data);
        scrapedContent.totalWords += data.wordCount;
      } catch (e) {
        console.warn(`[Scraper] Failed to fetch ${pageUrl}`);
      }
    }

    console.log(
      `[Scraper] Axios success: ${scrapedContent.pages.length} pages, ${scrapedContent.totalWords} words`
    );
    return scrapedContent;
  } catch (error) {
    throw new Error(`Axios request failed: ${error.message}`);
  }
}

/**
 * Extract content from HTML using Cheerio
 */
function extractContentFromHTML(html, url) {
  const $ = cheerio.load(html);

  // Remove non-content elements
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
      content.paragraphs.push(text);
    }
  });

  // Extract link text
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
  try {
    const response = await axios.head(url, { timeout: 5000, maxRedirects: 5 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

module.exports = {
  scrapeWebsite,
  validateUrl,
  extractContentFromHTML,
  scrapeWithPlaywright,
  scrapeWithAxios,
};
