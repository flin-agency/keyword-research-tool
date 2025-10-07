const express = require('express');
const { v4: uuidv4 } = require('uuid');
const scraperV2 = require('../services/scraper-v2');
const keywordExtractor = require('../services/keyword-extractor');
const googleAds = require('../services/google-ads-python');
const clustering = require('../services/clustering');
const exporter = require('../services/exporter');
const { getDemoScrapedContent } = require('../utils/demo-data');

const router = express.Router();

// In-memory storage for research jobs (replace with DB in production)
const jobs = new Map();

/**
 * POST /api/research
 * Start a new keyword research job
 */
router.post('/', async (req, res) => {
  try {
    const { url, country = '2756', language = null } = req.body; // Default to Switzerland

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    let validUrl;
    try {
      validUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const jobId = uuidv4();
    jobs.set(jobId, {
      id: jobId,
      url: validUrl.href,
      country,
      language,
      status: 'processing',
      progress: 0,
      step: 'initializing',
      createdAt: new Date(),
    });

    // Start processing asynchronously
    processResearch(jobId, validUrl.href, country, language);

    res.json({ job_id: jobId });
  } catch (error) {
    console.error('Error creating research job:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/research/:jobId
 * Get status and results of a research job
 */
router.get('/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
});

/**
 * GET /api/research/:jobId/export
 * Export research results
 */
router.get('/:jobId/export', (req, res) => {
  const { jobId } = req.params;
  const { format = 'csv' } = req.query;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({ error: 'Job not completed yet' });
  }

  try {
    if (format === 'csv') {
      const csv = exporter.toCSV(job.data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="keywords-${jobId}.csv"`);
      res.send(csv);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="keywords-${jobId}.json"`);
      res.json(job.data);
    } else {
      res.status(400).json({ error: 'Invalid format. Use csv or json' });
    }
  } catch (error) {
    console.error('Error exporting results:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process research asynchronously
 */
async function processResearch(jobId, url, country = '2756', language = null) {
  const job = jobs.get(jobId);

  try {
    // Step 1: Scrape website
    job.progress = 10;
    job.step = 'scanning website';
    console.log(`[${jobId}] Scanning website: ${url}`);

    let content;
    try {
      content = await scraperV2.scrapeWebsite(url);
    } catch (error) {
      console.warn(`[${jobId}] All scraping strategies failed, using demo data:`, error.message);
      content = getDemoScrapedContent(url);
    }

    // Step 2: Extract keywords with AI
    job.progress = 40;
    job.step = 'extracting keywords with AI';
    console.log(`[${jobId}] Extracting keywords with AI`);

    const seedKeywords = await keywordExtractor.extractKeywords(content, language);

    // Step 3: Query Google Ads API
    job.progress = 50;
    job.step = 'querying Google Ads API';
    console.log(`[${jobId}] Querying Google Ads API with ${seedKeywords.length} seed keywords`);

    let keywordData;
    try {
      keywordData = await googleAds.getKeywordMetrics(seedKeywords, country, language);
    } catch (error) {
      console.warn(`[${jobId}] Google Ads API error, using mock data:`, error.message);
      // Fallback to mock data if Python service is unavailable
      keywordData = generateMockKeywordData(seedKeywords);
    }

    // Step 4: Build topic clusters
    job.progress = 80;
    job.step = 'building topic clusters';
    console.log(`[${jobId}] Building topic clusters from ${keywordData.length} keywords`);

    const websiteContext = {
      url,
      description: content.pages[0]?.metaDescription || content.pages[0]?.title || '',
    };

    const clusters = await clustering.clusterKeywords(keywordData, websiteContext);

    // Step 5: Complete
    job.progress = 100;
    job.status = 'completed';
    job.step = 'completed';
    job.completedAt = new Date();
    job.data = {
      url,
      totalKeywords: keywordData.length,
      totalClusters: clusters.length,
      totalSearchVolume: clusters.reduce((sum, c) => sum + c.totalSearchVolume, 0),
      clusters,
      scrapedContent: {
        pages: content.pages,
        totalWords: content.totalWords,
      },
    };

    console.log(`[${jobId}] Research completed successfully`);
  } catch (error) {
    console.error(`[${jobId}] Error processing research:`, error);
    job.status = 'failed';
    job.error = error.message;
    job.progress = 0;
  }
}

/**
 * Generate mock keyword data (for testing without API access)
 */
function generateMockKeywordData(seedKeywords) {
  const mockData = [];

  seedKeywords.forEach((keyword) => {
    const baseCpc = parseFloat((Math.random() * 5 + 0.5).toFixed(2));
    const baseCpcHigh = parseFloat((baseCpc + Math.random() * 4 + 2).toFixed(2));

    mockData.push({
      keyword,
      searchVolume: Math.floor(Math.random() * 10000) + 100,
      competition: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      cpc: baseCpc,
      cpcHigh: baseCpcHigh,
    });

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
        cpcHigh,
      });
    }
  });

  return mockData.slice(0, parseInt(process.env.MAX_KEYWORDS, 10) || 500);
}

module.exports = router;
