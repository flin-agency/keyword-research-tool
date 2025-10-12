# Project Summary - Keyword Research Tool

## ✅ Current Capabilities

The keyword research tool now ships with a single, modern research pipeline that:

1. Accepts a website URL plus market and language selections from the UI.
2. Scrapes the target site with the resilient unified scraper (`backend/services/scraper-unified.js`).
3. Generates marketing-focused seed keywords through Gemini (`backend/services/gemini.js`) with a lightweight heading-based fallback.
4. Enriches keywords using the Node Google Ads bridge (`backend/services/google-ads-python.js`).
5. Builds multilingual topic clusters with the enhanced clustering engine (`backend/services/clustering-improved.js`).
6. Surfaces pillar topics, descriptions, and content strategies in the chosen language.
7. Lets users export finished research as CSV or JSON files.

---

## 🧪 Testing Status

Legacy Jest suites that targeted the deprecated pipeline have been removed. New integration and unit coverage should be authored around the improved services when automated testing is reinstated.

---

## 🗂️ Key Structure

```
keyword-research-tool/
├── backend/
│   ├── api/
│   │   ├── auth-google.js
│   │   ├── refresh-token.js
│   │   └── research.js              # Primary research API
│   ├── services/
│   │   ├── clustering-improved.js    # Hybrid clustering + Gemini enrichment
│   │   ├── exporter.js
│   │   ├── gemini.js                 # Language-aware AI utilities
│   │   ├── google-ads-python.js      # Google Ads metrics bridge
│   │   └── scraper-unified.js
│   └── server.js                     # Express server (improved stack)
├── frontend/
│   └── public/
│       ├── index.html                # Unified UI
│       └── app.js                    # Research workflow UI logic
├── python-ads-service/               # Python helper (optional deployment)
├── tests/                            # Remaining scraper/exporter coverage
├── utils/                            # Language utilities and demo data
└── package.json
```

---

## 🚀 Getting Started

```bash
npm install
npm start
```

The app is served at [http://localhost:3000](http://localhost:3000). Provide Google Ads and Gemini credentials through environment variables for production-grade data.

---

## 🔧 Tech Stack Highlights

- **Runtime**: Node.js + Express
- **Scraping**: Playwright/Axios unified scraper
- **AI**: Google Gemini (keyword extraction, cluster enrichment)
- **Clustering**: Density-based + semantic hybrid clustering
- **Exports**: CSV/JSON via `json2csv`
- **Frontend**: Vanilla JS single-page interface styled with modern components
