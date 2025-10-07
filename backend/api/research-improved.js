const express = require('express');
const { v4: uuidv4 } = require('uuid');
const scraperUnified = require('../services/scraper-unified');
const keywordExtractor = require('../services/keyword-extractor');
const googleAdsImproved = require('../services/google-ads-python');
const clusteringImproved = require('../services/clustering-improved');
const exporter = require('../services/exporter');
const { resolveLanguage } = require('../utils/language');

const router = express.Router();

// In-memory storage for research jobs (consider Redis for production)
const jobs = new Map();

// Rate limiting configuration
const REQUEST_LIMIT = 10; // Max requests per hour per IP
const requestCounts = new Map();

/**
 * Rate limiting middleware
 */
function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const hourAgo = now - 3600000;

  // Clean old entries
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const requests = requestCounts.get(ip).filter(time => time > hourAgo);

  if (requests.length >= REQUEST_LIMIT) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((requests[0] + 3600000 - now) / 1000),
    });
  }

  requests.push(now);
  requestCounts.set(ip, requests);
  next();
}

/**
 * Input validation middleware
 */
function validateInput(req, res, next) {
  const { url, country, language } = req.body;

  // Validate URL
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Normalize and validate URL
  let validUrl;
  try {
    const urlString = url.startsWith('http') ? url : `https://${url}`;
    validUrl = new URL(urlString);

    // Check for valid protocol
    if (!['http:', 'https:'].includes(validUrl.protocol)) {
      return res.status(400).json({ error: 'Invalid URL protocol. Use http or https.' });
    }

    req.validatedUrl = validUrl.href;
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Skip validation - we force Switzerland/German anyway
  next();
}

/**
 * POST /api/research
 * Start a new keyword research job
 */
router.post('/', rateLimiter, validateInput, async (req, res) => {
  try {
    const { country, language, options = {} } = req.body;
    const url = req.validatedUrl;
    const resolvedLanguage = resolveLanguage(language, country);

    const jobId = uuidv4();
    const job = {
      id: jobId,
      url,
      country,
      language: resolvedLanguage,
      requestedLanguage: language || null,
      options,
      status: 'processing',
      progress: 0,
      step: 'initializing',
      createdAt: new Date(),
      metadata: {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
      },
    };

    jobs.set(jobId, job);

    // Start processing asynchronously
    processResearch(jobId, url, country, resolvedLanguage, options);

    // Clean old jobs (older than 24 hours)
    cleanOldJobs();

    res.json({
      job_id: jobId,
      status: 'processing',
      message: 'Research job started successfully',
    });
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

  if (!isValidUUID(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID format' });
  }

  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found or expired' });
  }

  // Don't send internal metadata to client
  const { metadata, ...publicJob } = job;

  res.json(publicJob);
});

/**
 * GET /api/research/:jobId/export
 * Export research results
 */
router.get('/:jobId/export', (req, res) => {
  const { jobId } = req.params;
  const { format = 'csv' } = req.query;

  if (!isValidUUID(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID format' });
  }

  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found or expired' });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({
      error: 'Job not completed yet',
      status: job.status,
      progress: job.progress,
    });
  }

  try {
    const filename = `keywords-${job.data.url.replace(/[^a-z0-9]/gi, '_')}-${jobId.slice(0, 8)}`;

    if (format === 'csv') {
      const csv = exporter.toCSV(job.data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json(job.data);
    } else {
      res.status(400).json({
        error: 'Invalid format',
        supportedFormats: ['csv', 'json'],
      });
    }
  } catch (error) {
    console.error('Error exporting results:', error);
    res.status(500).json({ error: 'Export failed: ' + error.message });
  }
});

/**
 * DELETE /api/research/:jobId
 * Cancel or delete a research job
 */
router.delete('/:jobId', (req, res) => {
  const { jobId } = req.params;

  if (!isValidUUID(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID format' });
  }

  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Mark as cancelled if still processing
  if (job.status === 'processing') {
    job.status = 'cancelled';
    job.cancelledAt = new Date();
  }

  // Remove from jobs map
  jobs.delete(jobId);

  res.json({
    message: 'Job deleted successfully',
    jobId,
  });
});

/**
 * GET /api/research/config/countries
 * Get available countries - always returns Switzerland
 */
router.get('/config/countries', (req, res) => {
  res.json([{ code: '2756', name: 'Switzerland', defaultLanguage: 'de', currency: 'CHF' }]);
});

/**
 * GET /api/research/config/languages
 * Get available languages
 */
router.get('/config/languages', (req, res) => {
  res.json(['de', 'en', 'fr', 'it']);
});

/**
 * Process research asynchronously
 */
async function processResearch(jobId, url, country = '2756', language = null, options = {}) {
  const job = jobs.get(jobId);
  if (!job) return;

  const startTime = Date.now();
  const resolvedLanguage = resolveLanguage(language, country);
  updateJob(job, { language: resolvedLanguage });

  try {
    // Step 1: Scrape website (30% of progress)
    updateJob(job, {
      progress: 5,
      step: 'validating website',
    });

    // Validate URL is accessible
    const isValid = await scraperUnified.validateUrl(url);
    if (!isValid) {
      throw new Error('Website is not accessible. Please check the URL and try again.');
    }

    updateJob(job, {
      progress: 10,
      step: 'scanning website content',
    });

    console.log(`[${jobId}] Starting website scan: ${url}`);

    const content = await scraperUnified.scrapeWebsite(url, {
      strategy: options.scrapeStrategy || 'auto',
      maxPages: options.maxPages || 20,
      followLinks: options.followLinks !== false,
    });

    console.log(`[${jobId}] Scraped ${content.pages.length} pages, ${content.totalWords} words`);

    updateJob(job, {
      progress: 30,
      step: 'extracting keywords with AI',
    });

    // Step 2: Extract keywords (40% of progress)
    console.log(`[${jobId}] Extracting keywords with AI`);

    const seedKeywords = await keywordExtractor.extractKeywords(content, resolvedLanguage);

    if (!seedKeywords || seedKeywords.length === 0) {
      throw new Error('No keywords could be extracted from the website content');
    }

    console.log(`[${jobId}] Extracted ${seedKeywords.length} seed keywords`);

    updateJob(job, {
      progress: 50,
      step: 'fetching keyword metrics from Google Ads',
      extractedKeywords: seedKeywords.length,
    });

    // Step 3: Get keyword metrics (60% of progress)
    console.log(`[${jobId}] Fetching metrics from Google Ads API`);

    const keywordData = await googleAdsImproved.getKeywordMetrics(seedKeywords, country, resolvedLanguage);

    if (!keywordData || keywordData.length === 0) {
      throw new Error('Google Ads API returned no keyword data. Please check your API configuration and credentials.');
    }

    console.log(`[${jobId}] Retrieved ${keywordData.length} keywords with metrics`);

    updateJob(job, {
      progress: 70,
      step: 'building intelligent topic clusters',
      keywordsWithMetrics: keywordData.length,
    });

    // Step 4: Cluster keywords (80% of progress)
    console.log(`[${jobId}] Building topic clusters from ${keywordData.length} keywords`);

    const websiteContext = {
      url,
      description: content.pages[0]?.metaDescription || content.pages[0]?.title || '',
      title: content.pages[0]?.title || '',
    };

    const clusters = await clusteringImproved.clusterKeywords(keywordData, websiteContext, {
      algorithm: options.clusterAlgorithm || 'hybrid',
      useAI: options.useAI !== false,
      minClusterSize: options.minClusterSize || 3,
      language: resolvedLanguage,
    });

    console.log(`[${jobId}] Created ${clusters.length} topic clusters`);

    updateJob(job, {
      progress: 90,
      step: 'finalizing results',
    });    // Step 5: Prepare final results
    const processingTime = Date.now() - startTime;

    // Log AI content before preparing final data
    console.log(`[${jobId}] Checking AI content in clusters before final data preparation:`);
    clusters.slice(0, 3).forEach((c, i) => {
      console.log(`[${jobId}] Cluster ${i + 1} "${c.pillarTopic}":`, {
        hasAiDescription: !!c.aiDescription,
        hasAiContentStrategy: !!c.aiContentStrategy,
        aiDescriptionLength: c.aiDescription?.length || 0,
        aiContentStrategyLength: c.aiContentStrategy?.length || 0
      });
    });

    const finalData = {
      url,
      country: country,
      language: resolvedLanguage,
      requestedLanguage: job.requestedLanguage || null,
      totalKeywords: keywordData.length,
      totalClusters: clusters.length,
      totalSearchVolume: clusters.reduce((sum, c) => sum + c.totalSearchVolume, 0),
      avgSearchVolume: Math.round(
        clusters.reduce((sum, c) => sum + c.totalSearchVolume, 0) / keywordData.length
      ),
      clusters: clusters.slice(0, 50), // Limit to top 50 clusters
      summary: {
        pagesScraped: content.pages.length,
        wordsAnalyzed: content.totalWords,
        seedKeywords: seedKeywords.length,
        keywordsEnriched: keywordData.length,
        topCluster: clusters[0]?.pillarTopic || 'N/A',
        processingTimeMs: processingTime,
      },
      scrapedContent: {
        pages: content.pages.slice(0, 10), // Limit stored pages
        totalWords: content.totalWords,
      },    };

    // Log AI content in final data
    console.log(`[${jobId}] Checking AI content in finalData.clusters:`);
    finalData.clusters.slice(0, 3).forEach((c, i) => {
      console.log(`[${jobId}] Final cluster ${i + 1} "${c.pillarTopic}":`, {
        hasAiDescription: !!c.aiDescription,
        hasAiContentStrategy: !!c.aiContentStrategy
      });
    });

    // Complete job
    updateJob(job, {
      progress: 100,
      status: 'completed',
      step: 'completed',
      completedAt: new Date(),
      data: finalData,
      processingTime,
    });

    console.log(`[${jobId}] Research completed successfully in ${processingTime}ms`);

  } catch (error) {
    console.error(`[${jobId}] Error processing research:`, error);

    updateJob(job, {
      status: 'failed',
      error: error.message,
      failedAt: new Date(),
      progress: 0,
      processingTime: Date.now() - startTime,
    });
  }
}

/**
 * Update job status
 */
function updateJob(job, updates) {
  Object.assign(job, updates);
  job.updatedAt = new Date();
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Clean old jobs from memory
 */
function cleanOldJobs() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [jobId, job] of jobs.entries()) {
    const jobAge = now - job.createdAt.getTime();
    if (jobAge > maxAge) {
      jobs.delete(jobId);
      console.log(`[Cleanup] Removed old job ${jobId}`);
    }
  }
}

// Clean jobs periodically
setInterval(cleanOldJobs, 60 * 60 * 1000); // Every hour

module.exports = router;