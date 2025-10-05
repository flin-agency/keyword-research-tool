const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

/**
 * POST /api/refresh-token
 * Update only the Google Ads refresh token
 */
router.post('/', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Read current .env file
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

    // Update only the refresh token
    envVars['GOOGLE_ADS_REFRESH_TOKEN'] = refreshToken;

    // Build new env content
    const newEnvContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Write to .env file
    await fs.writeFile(envPath, newEnvContent);

    // Update process.env for current session
    process.env.GOOGLE_ADS_REFRESH_TOKEN = refreshToken;

    res.json({
      success: true,
      message: 'Refresh token updated successfully',
    });
  } catch (error) {
    console.error('Error updating refresh token:', error);
    res.status(500).json({
      error: 'Failed to update refresh token',
      message: error.message,
    });
  }
});

module.exports = router;