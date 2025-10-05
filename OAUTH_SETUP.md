# Google OAuth2 Setup Guide

This guide explains how to set up Google OAuth2 authentication to automatically get your refresh token.

## Prerequisites

You need to have:
- Google Ads Developer Token
- Google Cloud Console access

## Step 1: Set up OAuth2 Credentials in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Choose **Web application**
6. Configure:
   - **Name**: Keyword Research Tool
   - **Authorized redirect URIs**: Add `http://localhost:3000/api/auth/google/callback`
7. Click **Create**
8. Copy your **Client ID** and **Client Secret**

## Step 2: Enable Google Ads API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google Ads API"
3. Click **Enable**

## Step 3: Configure Your .env File

Add these to your `.env` file:

```env
GOOGLE_ADS_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your_client_secret_here
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token_here
GOOGLE_ADS_LOGIN_CUSTOMER_ID=your_manager_account_id
```

**Note:** Leave `GOOGLE_ADS_REFRESH_TOKEN` empty - it will be generated automatically!

## Step 4: Connect Your Google Account

1. Start the server: `npm run start:improved`
2. Open http://localhost:3000 in your browser
3. Click the **"Connect Google Account"** button
4. Sign in with your Google account
5. Grant permissions when prompted
6. You'll be redirected back to the app with a success message

The refresh token is now automatically saved to your `.env` file!

## Troubleshooting

### "redirect_uri_mismatch" error
- Make sure you added `http://localhost:3000/api/auth/google/callback` to your authorized redirect URIs in Google Cloud Console
- Check that the URI is exactly `http://localhost:3000/api/auth/google/callback` (no trailing slash)

### "Access blocked: This app's request is invalid"
- Make sure you enabled the Google Ads API in Google Cloud Console
- Verify your OAuth consent screen is configured

### No refresh token received
- The app uses `prompt: 'consent'` and `access_type: 'offline'` to force getting a refresh token
- If you previously authorized the app, revoke access at https://myaccount.google.com/permissions and try again

## Production Deployment

For production, update the redirect URI in:
1. Google Cloud Console credentials
2. `backend/api/auth-google.js` - change the redirect URI to your production URL