# 🔍 AI-Powered Keyword Research Tool

An intelligent keyword research tool that combines web scraping, AI-powered keyword extraction, Google Ads API integration, and smart topic clustering to help you discover valuable SEO opportunities.

## ✨ Features

- **🤖 AI-Powered Keyword Extraction** - Uses Gemini 2.0 to think like a marketer and identify business-relevant keywords
- **🌍 Multi-Country Support** - Get accurate search volumes for 11 countries (Switzerland, Germany, Austria, France, Italy, UK, US, Canada, Netherlands, Belgium, Spain)
- **🗣️ Multi-Language Support** - Extract keywords in 11 languages (English, German, French, Italian, Spanish, Dutch, Portuguese, Polish, Russian, Japanese, Chinese)
- **📊 Real Google Ads Data** - Direct integration with Google Ads Keyword Planner API for accurate search volumes, CPC, and competition data
- **🎯 Smart Topic Clustering** - ML-based K-Means clustering with AI enhancement to group keywords into actionable topics
- **📈 High-Volume Prioritization** - Automatically prioritizes keywords and topics with the highest search potential
- **🕷️ Multi-Strategy Web Scraping** - Robust scraping with Playwright, Axios fallbacks, and demo data
- **💾 Export Options** - Download results as CSV or JSON

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ installed
- Google Ads API credentials (optional - works with mock data otherwise)
- Gemini API key (optional - falls back to traditional NLP)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd keyword-researcher
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browsers** (for web scraping)
   ```bash
   npx playwright install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API credentials:
   - **Google Ads API**: Get credentials from [Google Ads API Setup](https://developers.google.com/google-ads/api/docs/first-call/overview)
   - **Gemini API**: Get your key from [Google AI Studio](https://aistudio.google.com/app/apikey)

5. **Start the server**
   ```bash
   npm start
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

## 📋 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Your Google Ads developer token | No* |
| `GOOGLE_ADS_CLIENT_ID` | OAuth 2.0 client ID | No* |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth 2.0 client secret | No* |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth 2.0 refresh token | No* |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Your Google Ads customer ID | No* |
| `GEMINI_API_KEY` | Gemini AI API key | No** |
| `MAX_PAGES_TO_SCAN` | Maximum pages to crawl per website (default: 20) | No |
| `MAX_KEYWORDS` | Maximum keywords to extract (default: 500) | No |
| `MIN_SEARCH_VOLUME` | Minimum monthly search volume (default: 10) | No |

\* Without Google Ads API credentials, the tool uses mock data for testing  
\*\* Without Gemini API key, the tool falls back to traditional NLP extraction

## 🏗️ Project Structure

```
keyword-researcher/
├── backend/
│   ├── api/
│   │   └── research.js          # Main API endpoints
│   ├── services/
│   │   ├── scraper-v2.js        # Multi-strategy web scraping
│   │   ├── keyword-extractor.js # AI + NLP keyword extraction
│   │   ├── google-ads.js        # Google Ads API integration
│   │   ├── clustering.js        # ML-based topic clustering
│   │   ├── gemini.js            # Gemini AI service
│   │   └── exporter.js          # CSV/JSON export
│   ├── utils/
│   │   └── demo-data.js         # Demo/fallback data
│   └── server.js                # Express server
├── frontend/
│   └── public/
│       ├── index.html           # Web interface
│       └── app.js               # Frontend logic
├── tests/
│   └── *.test.js                # Unit tests
├── .env.example                 # Environment template
├── package.json
└── README.md
```

## 🔧 How It Works

1. **Website Scanning** - Scrapes your target website using Playwright/Axios
2. **AI Keyword Extraction** - Gemini AI analyzes content and extracts marketing-relevant keywords
3. **Google Ads Enrichment** - Fetches real search volumes, CPC, and competition data
4. **Smart Clustering** - Groups keywords into topics using K-Means ML algorithm
5. **AI Enhancement** - Gemini refines cluster names and provides content strategies
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

### Core
- **Express** - Web server
- **Playwright** - Robust web scraping
- **Axios + Cheerio** - Fallback scraping

### AI & NLP
- **@google/generative-ai** - Gemini AI integration
- **google-ads-api** - Google Ads Keyword Planner
- **natural** - NLP processing
- **compromise** - POS tagging
- **stopword** - Stopword removal

### Machine Learning
- **ml-kmeans** - Topic clustering

### Testing
- **Jest** - Testing framework

## 🐛 Troubleshooting

### Scraping Issues
- **ECONNRESET errors**: The tool automatically falls back to Axios scraping
- **Timeout errors**: Increase timeout in scraper-v2.js
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
