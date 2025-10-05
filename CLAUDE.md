# Claude Code Instructions

## Project Context
This is a keyword research tool that scans websites, queries Google Ads Keyword Planner API, and builds topic clusters for SEO/content strategy.

## Permissions & Guidelines

### What Claude Can Do Freely
- Install any npm/pip packages needed for the project
- Create, modify, and delete project files as needed
- Set up project structure and architecture
- Implement features according to PLANNING.md
- Run build, test, and development commands
- Make technical decisions about implementation
- Refactor and optimize code
- Debug and fix errors
- Create configuration files (.env.example, config files, etc.)
- Use any tools, libraries, or APIs that help accomplish the goals
- Make commits when features are completed

### Tech Stack Freedom
- Choose between Node.js or Python backend (Python with FastAPI recommended for NLP tasks)
- Choose frontend framework (React/Next.js recommended)
- Select appropriate libraries for:
  - Web scraping (Puppeteer, Playwright, BeautifulSoup, Selenium)
  - NLP processing (spaCy, NLTK, compromise, natural)
  - Clustering (scikit-learn, ml.js)
  - API integration (google-ads-api, google-ads-python)

### Project Goals
1. Create a working web app where users input a URL
2. Scan the website and extract relevant keywords
3. Query Google Ads Keyword Planner API for keyword data
4. Build valuable topic clusters from the data
5. Display results in a user-friendly interface
6. Allow export of results

### Key Features to Implement
- URL input form
- Website content scraper
- Keyword extraction with NLP
- Google Ads API integration
- Topic clustering algorithm
- Results visualization
- Export functionality (CSV, JSON)
- Progress tracking
- Error handling

### Important Notes
- Prioritize getting a working MVP first
- Use environment variables for API credentials
- Handle errors gracefully
- Document API setup requirements
- Consider rate limits and API costs
- Cache results where possible
- **CRITICAL: NO MOCK DATA** - Never use mock/demo/fallback data. If APIs fail, report the actual error to the user. Real data only.

### No Permission Required For
- Creating any project files
- Installing dependencies
- Running commands
- Making architectural decisions
- Choosing specific implementations from PLANNING.md options

## Project Structure Suggestions
```
/
├── backend/
│   ├── api/
│   ├── services/
│   │   ├── scraper.js/py
│   │   ├── keyword-extractor.js/py
│   │   ├── google-ads.js/py
│   │   └── clustering.js/py
│   └── server.js/py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── api/
├── .env.example
├── package.json
└── README.md
```

**Claude: You have full autonomy to build this project as you see fit. Use the PLANNING.md as a guide, but make practical decisions based on what works best during implementation.**
