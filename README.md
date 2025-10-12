# 🔍 AI-Powered Keyword Research Tool

An intelligent keyword research tool that combines web scraping, AI-powered keyword extraction, Google Ads API integration, and smart topic clustering to help you discover valuable SEO opportunities.

## ✨ Features

- **🤖 AI-Powered Keyword Extraction** - Uses Gemini 2.5 to think like a marketer and identify business-relevant keywords
- **🌍 Multi-Country Support** - Get accurate search volumes for 11 countries (Switzerland, Germany, Austria, France, Italy, UK, US, Canada, Netherlands, Belgium, Spain)
- **🗣️ Multi-Language Support** - Extract keywords in 11 languages (English, German, French, Italian, Spanish, Dutch, Portuguese, Polish, Russian, Japanese, Chinese)
- **📊 Real Google Ads Data** - Direct integration with Google Ads Keyword Planner API for accurate search volumes, CPC, and competition data
- **🎯 Smart Topic Clustering** - ML-based K-Means clustering with AI enhancement to group keywords into actionable topics
- **📈 High-Volume Prioritization** - Automatically prioritizes keywords and topics with the highest search potential
- **🕷️ Multi-Strategy Web Scraping** - Robust scraping with Playwright, Axios fallbacks, and demo data
- **💾 Export Options** - Download results as CSV or JSON

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and npm
- **Python 3.10+** (required only when calling the Google Ads API)
- Ability to install [Playwright browsers](https://playwright.dev/docs/intro) (`npx playwright install chromium`)
- Optional but recommended API credentials:
  - Google Ads developer token, OAuth client, refresh token, and login customer ID
  - Gemini API key for AI-assisted keyword extraction

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/flin-agency/keyword-research-tool.git
   cd keyword-research-tool
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browsers** (Chromium is sufficient for scraping)
   ```bash
   npx playwright install chromium
   ```

4. **Install Python dependencies** (for Google Ads API v21)
   ```bash
   cd python-ads-service
   pip3 install -r requirements.txt
   cd ..
   ```

5. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   The Python microservice reads from the same root `.env`, so you only
   need to maintain a single environment file with all credentials:
   - **Google Ads API**: Get credentials from [Google Ads API Setup](https://developers.google.com/google-ads/api/docs/first-call/overview)
   - **Gemini API**: Get your key from [Google AI Studio](https://aistudio.google.com/app/apikey)

6. **Start the services**

   **Terminal 1 – Python microservice (port 5001)**

   Required for live Google Ads data. If you skip this step, the Node.js API automatically falls back to the built-in demo dataset.

   ```bash
   cd python-ads-service
   ```

   - **macOS / Linux**

     ```bash
     PYTHON_SERVICE_PORT=5001 python3 app.py
     ```

   - **Windows PowerShell**

     ```powershell
     $env:PYTHON_SERVICE_PORT=5001
     python app.py
     ```

   - **Windows Command Prompt**

     ```cmd
     set PYTHON_SERVICE_PORT=5001
     python app.py
     ```

   > 💡 Windows users with multiple Python installations can also run `py -3 app.py` after setting the environment variable in the same terminal.

   **Terminal 2 – Node.js server (port 3000)**

   ```bash
   cd keyword-research-tool
   npm start
   ```

7. **Open the app**

   Visit `http://localhost:3000` once the console logs show `Ready at http://localhost:3000`.

### Verify the setup

- `curl http://localhost:3000/health` – check service status and enabled integrations.
- Submit a URL through the UI to trigger scraping, AI keyword extraction, enrichment, clustering, and exports.

### Demo vs. production mode

- **Demo mode** (default): Leave Google Ads and Gemini variables empty in `.env`. The pipeline uses realistic mock keyword metrics so you can explore features quickly.
- **Production mode**: Populate all Google Ads fields and supply a Gemini key for the best results. Restart both services after changing credentials.

## 📋 Environment Variables

### Main Service (.env)

| Variable | Description | Required | Used by |
|----------|-------------|----------|---------|
| `PORT` | Express server port (default: 3000) | No | `backend/server.js` |
| `NODE_ENV` | Express environment mode | No | `backend/server.js` |
| `APP_BASE_URL` | Public base URL for OAuth callback generation | No | `backend/api/auth-google.js` |
| `MAX_REQUEST_SIZE` | Maximum JSON body size (default: 10mb) | No | `backend/server.js` |
| `CORS_ORIGIN` | Allowed origin for CORS requests | No | `backend/server.js` |
| `TRUST_PROXY` | Enable proxy headers (set to `true`) | No | `backend/server.js` |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads developer token | Yes* | `python-ads-service/app.py`, `backend/server.js` |
| `GOOGLE_ADS_CLIENT_ID` | OAuth 2.0 client ID | Yes* | `backend/api/auth-google.js`, `python-ads-service/app.py` |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth 2.0 client secret | Yes* | `backend/api/auth-google.js`, `python-ads-service/app.py` |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth 2.0 refresh token (generated post-auth) | Yes* | `backend/api/auth-google.js`, `backend/api/refresh-token.js`, `python-ads-service/app.py` |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Manager account ID (without dashes) | Yes* | `python-ads-service/app.py` |
| `GOOGLE_ADS_REDIRECT_URI` | Override OAuth redirect URI | No | `backend/api/auth-google.js` |
| `GEMINI_API_KEY` | Gemini AI API key | No** | `backend/services/gemini.js`, `backend/services/clustering-improved.js`, `backend/server.js` |
| `MAX_PAGES_TO_SCAN` | Maximum pages to crawl per domain (default: 20) | No | `backend/services/scraper-unified.js` |
| `SCRAPER_TIMEOUT` | Playwright page timeout in ms (default: 30000) | No | `backend/services/scraper-unified.js` |
| `MAX_KEYWORDS` | Maximum keywords to enrich (default: 500) | No | `backend/services/google-ads-python.js`, `python-ads-service/app.py` |
| `MIN_SEARCH_VOLUME` | Minimum monthly search volume (default: 10) | No | `backend/services/google-ads-python.js`, `python-ads-service/app.py` |
| `PYTHON_SERVICE_URL` | Python microservice URL (default: http://localhost:5001) | No | `backend/services/google-ads-python.js` |
| `PYTHON_SERVICE_PORT` | Python microservice port (default: 5001) | No | `python-ads-service/app.py` |
| `CHROME_EXECUTABLE_PATH` | Override Playwright Chrome binary path | No | `backend/services/scraper-unified.js` |

> **Usage verification:** Every variable in `.env.example` is consumed by the files listed above, so there are no unused entries in the template.

## 🏗️ Project Structure

```
keyword-research-tool/
├── backend/
│   ├── api/
│   │   ├── auth-google.js
│   │   ├── refresh-token.js
│   │   └── research.js             # Main API endpoints
│   ├── services/
│   │   ├── scraper-unified.js       # Multi-strategy web scraping
│   │   ├── google-ads-python.js     # Python microservice client
│   │   ├── clustering-improved.js   # ML + AI topic clustering
│   │   ├── gemini.js                # Gemini AI helpers
│   │   └── exporter.js              # CSV/JSON export
│   ├── utils/
│   │   └── demo-data.js             # Demo/fallback data
│   └── server.js                    # Express server (improved stack)
├── python-ads-service/              # Python microservice (Google Ads API v21)
│   ├── app.py                       # Flask service
│   └── requirements.txt             # Python dependencies
├── frontend/
│   └── public/
│       ├── index.html               # Unified UI
│       └── app.js                   # Frontend logic
├── tests/
│   ├── exporter.test.js
│   └── scraper.test.js
├── .env.example                     # Main service env template
├── package.json
└── README.md
```

## 🔧 How It Works

### Architecture

The tool uses a **microservice architecture** with two main components:

1. **Node.js Service (port 3000)** - Main application server handling web scraping, keyword extraction, clustering, and UI
2. **Python Microservice (port 5001)** - Dedicated service for Google Ads API v21 integration using official Python client library

### Workflow

1. **Website Scanning** - Scrapes your target website using the unified Playwright/Axios strategies
2. **AI Keyword Extraction** - Gemini AI analyzes content and extracts marketing-relevant keywords (with a headings fallback)
3. **Google Ads Enrichment** - Node.js service calls the Python microservice which fetches real search volumes, CPC, and competition data from Google Ads API v21
4. **Smart Clustering** - Groups keywords using hybrid density/semantic clustering and scores clusters
5. **AI Enhancement** - Gemini refines cluster names and provides localized content strategies
6. **Results Display** - Shows organized topics with full metrics and export options

## 📊 API Endpoints

### POST `/api/research`
Start a new keyword research job

**Request Body:**
```json
{
  "url": "https://example.com",
  "country": "2756",  // Country code (2756 = Switzerland)
  "language": "de"    // Language code (optional)
}
```

**Response:**
```json
{
  "job_id": "uuid-here"
}
```

### GET `/api/research/:jobId`
Get status and results of a research job

**Response:**
```json
{
  "id": "uuid",
  "status": "completed",
  "progress": 100,
  "data": {
    "totalKeywords": 500,
    "totalClusters": 15,
    "clusters": [...]
  }
}
```

### GET `/api/research/:jobId/export?format=csv`
Export results as CSV or JSON

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage
```

## 🌍 Supported Countries & Languages

### Countries (with geo-targeted search volumes)
- 🇨🇭 Switzerland (2756)
- 🇩🇪 Germany (2276)
- 🇦🇹 Austria (2040)
- 🇫🇷 France (2250)
- 🇮🇹 Italy (2380)
- 🇬🇧 United Kingdom (2826)
- 🇺🇸 United States (2840)
- 🇨🇦 Canada (2124)
- 🇳🇱 Netherlands (2528)
- 🇧🇪 Belgium (2056)
- 🇪🇸 Spain (2724)

### Languages
English, German, French, Italian, Spanish, Dutch, Portuguese, Polish, Russian, Japanese, Chinese

## 📦 Dependencies

### Node.js Service
- **Express** - Web server
- **Playwright** - Robust web scraping
- **Axios + Cheerio** - Fallback scraping
- **@google/generative-ai** - Gemini AI integration
- **natural** - NLP processing
- **compromise** - POS tagging
- **stopword** - Stopword removal
- **ml-kmeans** - Topic clustering

### Python Microservice
- **Flask** - Python web server
- **google-ads** (v28.0.0) - Google Ads API v21 client
- **python-dotenv** - Environment configuration

### Testing
- **Jest** - Testing framework

## 🐛 Troubleshooting

### Scraping Issues
- **ECONNRESET errors**: The tool automatically falls back to Axios scraping
- **Timeout errors**: Increase timeout in `backend/services/scraper-unified.js`
- **Blocked by website**: Some sites block automated scraping

### API Issues
- **Google Ads errors**: Verify your credentials and customer ID
- **Rate limiting**: Google Ads API has rate limits, reduce batch sizes if needed
- **Gemini API errors**: Check your API key and quota

### General
- **Port already in use**: Change `PORT` in .env
- **Memory issues**: Reduce `MAX_PAGES_TO_SCAN` or `MAX_KEYWORDS`

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please read CONTRIBUTING.md for guidelines.

## 🙏 Acknowledgments

- Google Ads API for keyword data
- Google Gemini for AI capabilities
- Playwright for reliable web scraping
- Natural.js for NLP processing

## 📧 Support

For issues and questions, please open a GitHub issue.

---

**Made with ❤️ for SEO professionals and marketers**
