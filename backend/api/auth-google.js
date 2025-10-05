const express = require('express');
const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// OAuth2 Configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_ADS_CLIENT_ID,
  process.env.GOOGLE_ADS_CLIENT_SECRET,
  'http://localhost:3000/api/auth/google/callback'
);

// Scopes needed for Google Ads API
const SCOPES = [
  'https://www.googleapis.com/auth/adwords'
];

/**
 * GET /api/auth/google
 * Redirect to Google OAuth2 consent screen
 */
router.get('/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent to get refresh token
  });

  res.redirect(authUrl);
});

/**
 * GET /api/auth/google/callback
 * Handle OAuth2 callback and get refresh token
 */
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return res.redirect('/?error=no_refresh_token');
    }

    // Update .env file with new refresh token
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
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

    // Update refresh token
    envVars['GOOGLE_ADS_REFRESH_TOKEN'] = tokens.refresh_token;

    // Build new env content
    const newEnvContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Write to .env file
    await fs.writeFile(envPath, newEnvContent);

    // Update process.env for current session
    process.env.GOOGLE_ADS_REFRESH_TOKEN = tokens.refresh_token;

    // Redirect back to app with success message
    res.redirect('/?success=true&message=' + encodeURIComponent('Google account connected successfully!'));

  } catch (error) {
    console.error('OAuth2 callback error:', error);
    res.redirect('/?error=' + encodeURIComponent(error.message));
  }
});

/**
 * GET /api/auth/status
 * Check if refresh token is configured
 */
router.get('/status', (req, res) => {
  res.json({
    configured: !!process.env.GOOGLE_ADS_REFRESH_TOKEN,
    hasClientId: !!process.env.GOOGLE_ADS_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_ADS_CLIENT_SECRET
  });
});

module.exports = router;