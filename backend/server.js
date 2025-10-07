const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const researchRouter = require('./api/research-improved');
const refreshTokenRouter = require('./api/refresh-token');
const authRouter = require('./api/auth-google');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const config = {
  maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  trustProxy: process.env.TRUST_PROXY === 'true',
  environment: process.env.NODE_ENV || 'development',
};

if (config.trustProxy) {
  app.set('trust proxy', true);
}

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: config.maxRequestSize }));
app.use(express.urlencoded({ extended: true, limit: config.maxRequestSize }));

if (config.environment === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.static(path.join(__dirname, '../frontend/public'), {
  index: 'index-simple.html',
  maxAge: config.environment === 'production' ? '1d' : 0,
}));

app.use('/api/research', researchRouter);
app.use('/api/refresh-token', refreshTokenRouter);
app.use('/api/auth', authRouter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.environment,
    services: {
      googleAds: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      geminiAI: !!process.env.GEMINI_API_KEY,
    },
  });
});

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

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index-simple.html'));
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Server] Keyword Research Tool ready on port ${PORT}`);
  });
}

module.exports = app;
