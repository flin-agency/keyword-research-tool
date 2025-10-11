const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import routers
const researchRouter = require('./api/research-improved');

const refreshTokenRouter = require('./api/refresh-token');
const authRouter = require('./api/auth-google');

const app = express();
const PORT = process.env.PORT || 3000;

let server;

// Configuration
const config = {
  maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  trustProxy: process.env.TRUST_PROXY === 'true',
  environment: process.env.NODE_ENV || 'development',
};

// Trust proxy if configured (important for rate limiting)
if (config.trustProxy) {
  app.set('trust proxy', true);
}

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: config.maxRequestSize }));
app.use(express.urlencoded({ extended: true, limit: config.maxRequestSize }));

// Request logging middleware (development only)
if (config.environment === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend/public'), {
  index: 'index.html',
  maxAge: config.environment === 'production' ? '1d' : 0,
}));

// API Routes
app.use('/api/research', researchRouter);
app.use('/api/refresh-token', refreshTokenRouter);
app.use('/api/auth', authRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.environment,
    version: process.env.npm_package_version || '1.0.0',
  };

  // Check critical services
  const services = {
    googleAds: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    geminiAI: !!process.env.GEMINI_API_KEY,
  };

  res.json({ ...health, services });
});

// API information endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Keyword Research Tool API',
    version: process.env.npm_package_version || '1.0.0',
    description: 'AI-powered keyword research with Google Ads integration',
    endpoints: {
      research: {
        POST: '/api/research - Start a new research job',
        GET: '/api/research/:jobId - Get job status and results',
        DELETE: '/api/research/:jobId - Cancel or delete a job',
        EXPORT: '/api/research/:jobId/export - Export results (csv/json)',
      },
      config: {
        GET: '/api/research/config/countries - Get available countries',
        GET: '/api/research/config/languages - Get available languages',
      },
    },
    features: {
      webScraping: true,
      aiKeywordExtraction: !!process.env.GEMINI_API_KEY,
      googleAdsAPI: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      clustering: true,
      export: ['csv', 'json'],
    },
  });
});

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
  });
});

// Catch-all route for frontend (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error]', err);

  // Don't leak error details in production
  const isDev = config.environment === 'development';

  const errorResponse = {
    error: 'Internal server error',
    message: isDev ? err.message : 'An unexpected error occurred',
  };

  if (isDev && err.stack) {
    errorResponse.stack = err.stack.split('\n');
  }

  res.status(err.status || 500).json(errorResponse);
});

// Track shutdown state to avoid duplicate work
let isShuttingDown = false;

// Graceful shutdown handler
function gracefulShutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log('[Server] Shutting down gracefully...');

  const finalize = () => {
    console.log('[Server] HTTP server closed');
    process.exitCode = 0;

    // On Windows terminals the parent cmd.exe process can prompt the user to
    // terminate the "batch job" after Ctrl+C. Pausing stdin allows Node.js to
    // finish without keeping the prompt open for further interaction.
    if (process.platform === 'win32' && process.stdin && typeof process.stdin.pause === 'function') {
      process.stdin.pause();
    }
  };

  if (server && server.listening) {
    server.close(finalize);
  } else {
    finalize();
  }
}

// Handle shutdown signals
['SIGTERM', 'SIGINT'].forEach((signal) => {
  process.on(signal, () => gracefulShutdown(signal));
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Fatal] Uncaught exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fatal] Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

// Start server
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log('[Server] Starting Keyword Research Tool');
    console.log(`[Server] Environment: ${config.environment}`);
    console.log(`[Server] Port: ${PORT}`);
    console.log('[Server] API: Improved');
    console.log(`[Server] Google Ads API: ${process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? 'Configured' : 'Not configured'}`);
    console.log(`[Server] Gemini AI: ${process.env.GEMINI_API_KEY ? 'Configured' : 'Not configured'}`);
    console.log(`[Server] Ready at http://localhost:${PORT}`);
  });
}

module.exports = app;
