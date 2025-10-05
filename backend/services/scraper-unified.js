const { chromium } = require('playwright');
const axios = require('axios');
const cheerio = require('cheerio');

// Configuration
const MAX_PAGES = parseInt(process.env.MAX_PAGES_TO_SCAN) || 20;
const PAGE_TIMEOUT = parseInt(process.env.SCRAPER_TIMEOUT) || 30000;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

/**
 * Unified scraper with multiple strategies and better error handling
 * @param {string} url - The URL to scrape
 * @param {object} options - Scraping options
 * @returns {Promise<object>} Scraped content
 */
async function scrapeWebsite(url, options = {}) {
  const {
    strategy = 'auto', // 'playwright', 'axios', 'auto'
    maxPages = MAX_PAGES,
    timeout = PAGE_TIMEOUT,
    followLinks = true,
    retryAttempts = RETRY_ATTEMPTS,
  } = options;

  console.log(`[Scraper] Starting scrape of ${url} with strategy: ${strategy}`);

  // Input validation
  if (!isValidUrl(url)) {
    throw new Error('Invalid URL provided');
  }

  let result = null;
  let lastError = null;

  // Auto strategy: try Playwright first, then Axios
  if (strategy === 'auto' || strategy === 'playwright') {
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        result = await scrapeWithPlaywright(url, { maxPages, timeout, followLinks });
        if (result && result.pages.length > 0) {
          console.log(`[Scraper] Playwright succeeded on attempt ${attempt}`);
          break;
        }
      } catch (error) {
        lastError = error;
        console.warn(`[Scraper] Playwright attempt ${attempt} failed: ${error.message}`);
        if (attempt < retryAttempts) {
          await sleep(RETRY_DELAY * attempt);
        }
      }
    }
  }

  // Fallback to Axios if Playwright failed or not selected
  if (!result && (strategy === 'auto' || strategy === 'axios')) {
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        result = await scrapeWithAxios(url, { maxPages, timeout, followLinks });
        if (result && result.pages.length > 0) {
          console.log(`[Scraper] Axios succeeded on attempt ${attempt}`);
          break;
        }
      } catch (error) {
        lastError = error;
        console.warn(`[Scraper] Axios attempt ${attempt} failed: ${error.message}`);
        if (attempt < retryAttempts) {
          await sleep(RETRY_DELAY * attempt);
        }
      }
    }
  }

  if (!result || result.pages.length === 0) {
    throw new Error(`All scraping strategies failed: ${lastError?.message || 'Unknown error'}`);
  }

  // Add metadata
  result.metadata = {
    url,
    scrapedAt: new Date().toISOString(),
    strategy: result.strategy || 'unknown',
    pagesScraped: result.pages.length,
    totalWords: result.totalWords,
  };

  return result;
}

/**
 * Scrape using Playwright (handles JavaScript-rendered content)
 */
async function scrapeWithPlaywright(url, options = {}) {
  const { maxPages, timeout, followLinks } = options;
  let browser = null;

  try {
    // Launch browser with optimized settings
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
      timeout: 10000,
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    });

    // Block unnecessary resources for faster loading
    await context.route('**/*.{png,jpg,jpeg,gif,svg,webp,css,font,woff,woff2}', route => route.abort());

    const page = await context.newPage();
    page.setDefaultTimeout(timeout);

    const visitedUrls = new Set();
    const pagesToVisit = [normalizeUrl(url)];
    const scrapedContent = {
      pages: [],
      totalWords: 0,
      strategy: 'playwright',
    };

    while (pagesToVisit.length > 0 && visitedUrls.size < maxPages) {
      const currentUrl = pagesToVisit.shift();

      if (visitedUrls.has(currentUrl)) continue;
      visitedUrls.add(currentUrl);

      try {
        console.log(`[Playwright] Visiting: ${currentUrl}`);

        // Navigate with retry logic
        const response = await page.goto(currentUrl, {
          waitUntil: 'domcontentloaded',
          timeout: timeout,
        });

        // Check if page loaded successfully
        if (!response || response.status() >= 400) {
          console.warn(`[Playwright] Page returned status ${response?.status() || 'unknown'}`);
          continue;
        }

        // Wait for content to be visible
        await page.waitForSelector('body', { timeout: 5000 }).catch(() => {});

        // Extract content
        const html = await page.content();
        const pageData = extractContentFromHTML(html, currentUrl);

        if (pageData.wordCount > 0) {
          scrapedContent.pages.push(pageData);
          scrapedContent.totalWords += pageData.wordCount;
        }

        // Find internal links (only from first page)
        if (followLinks && visitedUrls.size === 1) {
          const links = await extractInternalLinks(page, url);
          const uniqueLinks = [...new Set(links)].slice(0, maxPages - 1);
          pagesToVisit.push(...uniqueLinks);
        }
      } catch (error) {
        console.warn(`[Playwright] Error on ${currentUrl}: ${error.message}`);
      }
    }

    return scrapedContent;
  } finally {
    if (browser) {
      await browser.close().catch(console.error);
    }
  }
}

/**
 * Scrape using Axios (lightweight, for static sites)
 */
async function scrapeWithAxios(url, options = {}) {
  const { maxPages, timeout, followLinks } = options;

  const scrapedContent = {
    pages: [],
    totalWords: 0,
    strategy: 'axios',
  };

  const visitedUrls = new Set();
  const pagesToVisit = [normalizeUrl(url)];

  // Configure axios with retry interceptor
  const axiosInstance = axios.create({
    timeout: timeout,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
    maxRedirects: 5,
    validateStatus: (status) => status < 500,
  });

  while (pagesToVisit.length > 0 && visitedUrls.size < maxPages) {
    const currentUrl = pagesToVisit.shift();

    if (visitedUrls.has(currentUrl)) continue;
    visitedUrls.add(currentUrl);

    try {
      console.log(`[Axios] Fetching: ${currentUrl}`);

      const response = await axiosInstance.get(currentUrl);

      if (response.status >= 400) {
        console.warn(`[Axios] Page returned status ${response.status}`);
        continue;
      }

      const pageData = extractContentFromHTML(response.data, currentUrl);

      if (pageData.wordCount > 0) {
        scrapedContent.pages.push(pageData);
        scrapedContent.totalWords += pageData.wordCount;
      }

      // Extract links from first page only
      if (followLinks && visitedUrls.size === 1) {
        const $ = cheerio.load(response.data);
        const baseDomain = new URL(url).hostname;
        const links = [];

        $('a[href]').each((_, el) => {
          try {
            const href = $(el).attr('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
              return;
            }

            const fullUrl = new URL(href, currentUrl);
            if (fullUrl.hostname === baseDomain && !links.includes(fullUrl.href)) {
              links.push(normalizeUrl(fullUrl.href));
            }
          } catch (e) {
            // Invalid URL, skip
          }
        });

        const uniqueLinks = [...new Set(links)].slice(0, maxPages - 1);
        pagesToVisit.push(...uniqueLinks);
      }
    } catch (error) {
      console.warn(`[Axios] Error on ${currentUrl}: ${error.message}`);
    }
  }

  return scrapedContent;
}

/**
 * Extract content from HTML with improved parsing
 */
function extractContentFromHTML(html, url) {
  const $ = cheerio.load(html, { decodeEntities: true });

  // Remove non-content elements more aggressively
  $('script, style, noscript, iframe, object, embed, nav, footer, header, aside, .sidebar, .menu, .navigation, .cookie-banner, .popup, .modal, .advertisement, .ads, #comments, .comments').remove();

  const content = {
    url,
    title: $('title').text().trim() || $('h1').first().text().trim() || '',
    metaDescription: $('meta[name="description"]').attr('content') ||
                     $('meta[property="og:description"]').attr('content') || '',
    metaKeywords: $('meta[name="keywords"]').attr('content') || '',
    headings: {
      h1: [],
      h2: [],
      h3: [],
    },
    paragraphs: [],
    listItems: [],
    links: [],
    images: [],
    wordCount: 0,
  };

  // Extract headings with deduplication
  const extractedH1s = new Set();
  $('h1').each((_, el) => {
    const text = $(el).text().trim();
    if (text && !extractedH1s.has(text)) {
      extractedH1s.add(text);
      content.headings.h1.push(text);
    }
  });

  const extractedH2s = new Set();
  $('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text && !extractedH2s.has(text)) {
      extractedH2s.add(text);
      content.headings.h2.push(text);
    }
  });

  const extractedH3s = new Set();
  $('h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text && !extractedH3s.has(text)) {
      extractedH3s.add(text);
      content.headings.h3.push(text);
    }
  });

  // Extract paragraphs (with minimum word count)
  $('p, article, section, main').each((_, el) => {
    const text = $(el).clone().children().remove().end().text().trim();
    if (text && text.split(/\s+/).length >= 10) {
      content.paragraphs.push(text);
    }
  });

  // Extract list items
  $('li').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 10) {
      content.listItems.push(text);
    }
  });

  // Extract meaningful link text
  const extractedLinks = new Set();
  $('a').each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');
    if (text && text.length > 3 && !extractedLinks.has(text) && href && !href.startsWith('#')) {
      extractedLinks.add(text);
      content.links.push(text);
    }
  });

  // Extract image alt text
  $('img[alt]').each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt && alt.length > 3) {
      content.images.push(alt);
    }
  });

  // Calculate word count from all content
  const allText = [
    content.title,
    content.metaDescription,
    content.metaKeywords,
    ...content.headings.h1,
    ...content.headings.h2,
    ...content.headings.h3,
    ...content.paragraphs,
    ...content.listItems,
    ...content.links.slice(0, 50), // Limit link text
    ...content.images,
  ].join(' ');

  content.wordCount = allText.split(/\s+/).filter(w => w.length > 0).length;

  return content;
}

/**
 * Extract internal links from a Playwright page
 */
async function extractInternalLinks(page, baseUrl) {
  const baseDomain = new URL(baseUrl).hostname;

  const links = await page.$$eval('a[href]', (anchors, domain) => {
    return anchors
      .map(a => {
        try {
          const href = a.getAttribute('href');
          if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return null;
          }
          const fullUrl = new URL(href, window.location.href);
          if (fullUrl.hostname === domain) {
            return fullUrl.href;
          }
          return null;
        } catch {
          return null;
        }
      })
      .filter(link => link !== null);
  }, baseDomain);

  return links.map(link => normalizeUrl(link));
}

/**
 * Validate URL format
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize URL (remove trailing slashes, fragments, etc.)
 */
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    urlObj.hash = '';
    let normalized = urlObj.href;
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate if URL is accessible (lightweight check)
 */
async function validateUrl(url) {
  try {
    const response = await axios.head(url, {
      timeout: 5000,
      maxRedirects: 5,
      validateStatus: (status) => status < 400,
    });
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