const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';

/**
 * GET /api/settings
 * Get current API configuration status
 */
router.get('/', async (req, res) => {
  const status = {
    googleAds: {
      configured: !!(
        process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
        process.env.GOOGLE_ADS_CLIENT_ID &&
        process.env.GOOGLE_ADS_CLIENT_SECRET &&
        process.env.GOOGLE_ADS_REFRESH_TOKEN &&
        process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
      ),
    },
    gemini: {
      configured: !!process.env.GEMINI_API_KEY,
    },
  };

  res.json(status);
});

/**
 * POST /api/settings
 * Update API settings (updates .env file)
 */
router.post('/', async (req, res) => {
  try {
    const { googleAds, gemini } = req.body;

    // Read current .env file
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      // .env file doesn't exist, create new one
      console.log('Creating new .env file');
    }

    // Parse existing env content
    const envLines = envContent.split('\n');
    const envVars = {};

    envLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    // Update with new values
    if (googleAds) {
      if (googleAds.developerToken) {
        envVars['GOOGLE_ADS_DEVELOPER_TOKEN'] = googleAds.developerToken;
      }
      if (googleAds.clientId) {
        envVars['GOOGLE_ADS_CLIENT_ID'] = googleAds.clientId;
      }
      if (googleAds.clientSecret) {
        envVars['GOOGLE_ADS_CLIENT_SECRET'] = googleAds.clientSecret;
      }
      if (googleAds.refreshToken) {
        envVars['GOOGLE_ADS_REFRESH_TOKEN'] = googleAds.refreshToken;
      }
      if (googleAds.loginCustomerId) {
        envVars['GOOGLE_ADS_LOGIN_CUSTOMER_ID'] = googleAds.loginCustomerId;
      }
    }

    if (gemini) {
      if (gemini.apiKey) {
        envVars['GEMINI_API_KEY'] = gemini.apiKey;
      }
    }

    // Build new env content
    const newEnvContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Write to .env file
    await fs.writeFile(envPath, newEnvContent);

    // Update process.env for current session
    if (googleAds) {
      if (googleAds.developerToken) process.env.GOOGLE_ADS_DEVELOPER_TOKEN = googleAds.developerToken;
      if (googleAds.clientId) process.env.GOOGLE_ADS_CLIENT_ID = googleAds.clientId;
      if (googleAds.clientSecret) process.env.GOOGLE_ADS_CLIENT_SECRET = googleAds.clientSecret;
      if (googleAds.refreshToken) process.env.GOOGLE_ADS_REFRESH_TOKEN = googleAds.refreshToken;
      if (googleAds.loginCustomerId) process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = googleAds.loginCustomerId;
    }

    if (gemini) {
      if (gemini.apiKey) process.env.GEMINI_API_KEY = gemini.apiKey;
    }

    res.json({
      success: true,
      message: 'Settings updated successfully. Please restart the server for changes to take full effect.',
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      error: 'Failed to update settings',
      message: error.message,
    });
  }
});

/**
 * POST /api/settings/test
 * Test API connections
 */
router.post('/test', async (req, res) => {
  const { googleAds, gemini } = req.body;
  const results = {
    googleAds: false,
    gemini: false,
    errors: {},
  };

  // Test Google Ads API
  if (googleAds && googleAds.developerToken && googleAds.clientId &&
      googleAds.clientSecret && googleAds.refreshToken) {
    try {
      const response = await axios.post(`${PYTHON_SERVICE_URL}/test-credentials`, {
        credentials: {
          developer_token: googleAds.developerToken,
          client_id: googleAds.clientId,
          client_secret: googleAds.clientSecret,
          refresh_token: googleAds.refreshToken,
          login_customer_id: (googleAds.loginCustomerId || '').replace(/-/g, ''),
        },
        keywords: ['test keyword'],
        country: googleAds.country || '2756',
        language: googleAds.language || 'de',
      }, {
        timeout: 45000,
      });

      if (response.data && response.data.success) {
        results.googleAds = true;
      } else {
        results.errors.googleAds = response.data?.error || 'Python Google Ads service returned an unexpected response';
      }
    } catch (error) {
      console.error('Google Ads API test failed:', error);
      const message = error.response?.data?.error || error.message || 'Unknown error contacting Python service';
      results.errors.googleAds = message;
    }
  } else {
    results.errors.googleAds = 'Missing Google Ads credentials';
  }

  // Test Gemini API
  if (gemini && gemini.apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(gemini.apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      // Simple test prompt
      const result = await model.generateContent('Hello, respond with "OK" if you receive this.');

      if (result && result.response) {
        results.gemini = true;
      }
    } catch (error) {
      console.error('Gemini API test failed:', error);
      results.errors.gemini = error.message;
    }
  }

  res.json(results);
});

/**
 * DELETE /api/settings
 * Clear API settings
 */
router.delete('/', async (req, res) => {
  try {
    const envPath = path.join(process.cwd(), '.env');

    // Read current .env file
    let envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      return res.json({ message: 'No settings to clear' });
    }

    // Parse and filter out API-related variables
    const envLines = envContent.split('\n');
    const filteredLines = envLines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return true;

      const key = trimmed.split('=')[0];
      const apiKeys = [
        'GOOGLE_ADS_DEVELOPER_TOKEN',
        'GOOGLE_ADS_CLIENT_ID',
        'GOOGLE_ADS_CLIENT_SECRET',
        'GOOGLE_ADS_REFRESH_TOKEN',
        'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
        'GEMINI_API_KEY',
      ];

      return !apiKeys.includes(key);
    });

    // Write filtered content back
    await fs.writeFile(envPath, filteredLines.join('\n'));

    // Clear from process.env
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    delete process.env.GOOGLE_ADS_CLIENT_ID;
    delete process.env.GOOGLE_ADS_CLIENT_SECRET;
    delete process.env.GOOGLE_ADS_REFRESH_TOKEN;
    delete process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    delete process.env.GEMINI_API_KEY;

    res.json({
      success: true,
      message: 'API settings cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing settings:', error);
    res.status(500).json({
      error: 'Failed to clear settings',
      message: error.message,
    });
  }
});

module.exports = router;