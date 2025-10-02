# Keyword Research Tool - Planning Document

## Project Overview
A web application that automates keyword research by scanning a website, using Google Ads Keyword Planner API to gather keyword data, and building valuable topic clusters for SEO/content strategy.

## Core Workflow
1. User inputs a website URL
2. System scans website and extracts relevant keywords
3. System queries Google Ads Keyword Planner API for keyword research
4. System builds topic clusters based on keyword data
5. User receives comprehensive keyword research report

---

## Technical Architecture

### 1. Frontend (Web Interface)
- **Technology Options**: React/Next.js, Vue.js, or vanilla HTML/CSS/JS
- **Features**:
  - Simple input form for website URL
  - Loading state/progress indicator
  - Results display with topic clusters
  - Export functionality (CSV, PDF)

### 2. Backend API
- **Technology Options**: Node.js/Express, Python/Flask, Python/FastAPI
- **Endpoints**:
  - `POST /api/research` - Start keyword research for a URL
  - `GET /api/research/:id` - Get research status/results
  - `GET /api/export/:id` - Export results

### 3. Website Scanning Module
**Purpose**: Extract relevant keywords and content from target website

**Implementation Steps**:
- Web scraper (using Puppeteer, Playwright, or Cheerio for Node.js / BeautifulSoup for Python)
- Extract:
  - Page titles and meta descriptions
  - Headings (H1, H2, H3)
  - Body content
  - Alt text from images
  - Internal link anchor text
- Text processing:
  - Remove stop words
  - Extract key phrases (2-4 word combinations)
  - Frequency analysis
  - TF-IDF scoring

### 4. Google Ads Keyword Planner Integration
**Purpose**: Get search volume, competition, and related keyword data

**Requirements**:
- Google Ads API account setup
- OAuth 2.0 authentication
- API credentials (developer token, client ID, client secret)

**Implementation**:
- Use Google Ads API Client Library
  - Node.js: `google-ads-api`
  - Python: `google-ads-python`
- Query Keyword Planner service:
  - Generate keyword ideas from seed keywords
  - Get search volume metrics
  - Get competition level
  - Get suggested bid prices
  - Get related keywords

**Key Metrics to Collect**:
- Search volume (monthly average)
- Competition level (low/medium/high)
- CPC bid range
- Keyword difficulty
- Related keywords
- Question-based keywords

### 5. Topic Clustering Module
**Purpose**: Group related keywords into meaningful topic clusters

**Clustering Algorithm Options**:
1. **Semantic Similarity Clustering**:
   - Use NLP libraries (spaCy, NLTK)
   - Calculate cosine similarity between keywords
   - Group keywords with high similarity scores

2. **K-Means Clustering**:
   - Convert keywords to vectors (TF-IDF or word embeddings)
   - Apply K-Means algorithm
   - Determine optimal K using elbow method

3. **Hierarchical Clustering**:
   - Create dendrogram of keyword relationships
   - Cut tree at optimal height for clusters

**Cluster Analysis**:
- Identify pillar topics (high search volume + low competition)
- Identify supporting topics
- Calculate cluster value score:
  - Total search volume
  - Average competition
  - Business relevance score

**Output Structure**:
```json
{
  "clusters": [
    {
      "id": 1,
      "pillar_topic": "main keyword theme",
      "keywords": [
        {
          "keyword": "example keyword",
          "search_volume": 10000,
          "competition": "low",
          "cpc": 2.50,
          "relevance_score": 0.85
        }
      ],
      "total_search_volume": 50000,
      "avg_competition": "medium",
      "cluster_value_score": 0.78
    }
  ]
}
```

---

## Implementation Phases

### Phase 1: Setup & Infrastructure
- [ ] Set up project structure
- [ ] Choose tech stack
- [ ] Set up Google Ads API credentials
- [ ] Create basic frontend interface
- [ ] Set up backend API skeleton

### Phase 2: Website Scanning
- [ ] Implement web scraper
- [ ] Extract content from HTML
- [ ] Process and clean text data
- [ ] Extract seed keywords using NLP
- [ ] Test with various websites

### Phase 3: Google Ads API Integration
- [ ] Implement OAuth 2.0 flow
- [ ] Connect to Keyword Planner API
- [ ] Query keyword metrics for seed keywords
- [ ] Retrieve related keywords
- [ ] Handle API rate limits and errors
- [ ] Cache results to minimize API calls

### Phase 4: Topic Clustering
- [ ] Implement keyword vectorization
- [ ] Build clustering algorithm
- [ ] Calculate cluster metrics
- [ ] Identify pillar topics
- [ ] Rank clusters by value

### Phase 5: Results & Export
- [ ] Design results display UI
- [ ] Implement data visualization (charts, graphs)
- [ ] Add export functionality (CSV, JSON, PDF)
- [ ] Add filters and sorting options

### Phase 6: Optimization & Polish
- [ ] Add progress tracking
- [ ] Implement error handling
- [ ] Optimize performance
- [ ] Add documentation
- [ ] Testing and bug fixes

---

## Key Challenges & Solutions

### Challenge 1: Google Ads API Access
**Issue**: Requires billing account and approval process
**Solution**:
- Use test account for development
- Implement alternative APIs as backup (DataForSEO, SEMrush API)
- Consider using Google Trends API for initial testing

### Challenge 2: Website Scanning at Scale
**Issue**: Some websites block scrapers, have rate limits, or require JavaScript rendering
**Solution**:
- Use headless browser (Puppeteer/Playwright)
- Implement rate limiting and delays
- Add user-agent rotation
- Handle robots.txt compliance

### Challenge 3: Determining "Business Relevance"
**Issue**: Not all high-volume keywords are relevant to the business
**Solution**:
- Compare extracted keywords with site content
- Calculate relevance score based on frequency and context
- Allow user to filter/adjust results

### Challenge 4: API Rate Limits & Costs
**Issue**: Google Ads API has rate limits and potential costs
**Solution**:
- Cache results for same URLs
- Batch API requests efficiently
- Implement queue system for multiple requests
- Monitor API usage and costs

---

## Data Flow Diagram

```
User Input (URL)
      ↓
Website Scanner → Extract Content → Generate Seed Keywords
      ↓
Google Ads API ← Query with Seeds → Get Keyword Data
      ↓
Keyword Database (temporary storage)
      ↓
Topic Clustering Algorithm → Group by Similarity
      ↓
Results Processing → Calculate Metrics → Rank Clusters
      ↓
Display to User / Export
```

---

## Tech Stack Recommendations

### Option A: Node.js Full Stack
- **Frontend**: React/Next.js
- **Backend**: Node.js/Express
- **Scraping**: Puppeteer
- **NLP**: compromise, natural
- **API**: google-ads-api
- **Clustering**: ml.js, tf.js

### Option B: Python Backend + JS Frontend
- **Frontend**: React/Vue.js
- **Backend**: Python/FastAPI
- **Scraping**: BeautifulSoup + Selenium
- **NLP**: spaCy, NLTK
- **API**: google-ads-python
- **Clustering**: scikit-learn, pandas

---

## Environment Variables Needed

```env
# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=xxx
GOOGLE_ADS_CLIENT_ID=xxx
GOOGLE_ADS_CLIENT_SECRET=xxx
GOOGLE_ADS_REFRESH_TOKEN=xxx
GOOGLE_ADS_LOGIN_CUSTOMER_ID=xxx

# Application
PORT=3000
NODE_ENV=development
DATABASE_URL=xxx (if persisting data)

# Optional: Alternative APIs
DATAFORSEO_LOGIN=xxx
DATAFORSEO_PASSWORD=xxx
```

---

## API Endpoints Design

```
POST /api/research
Body: { "url": "https://example.com" }
Response: { "job_id": "uuid" }

GET /api/research/:job_id
Response: {
  "status": "processing|completed|failed",
  "progress": 75,
  "data": { /* results */ }
}

GET /api/export/:job_id?format=csv|json|pdf
Response: File download

POST /api/refine-clusters
Body: { "job_id": "uuid", "filters": {} }
Response: { "refined_clusters": [] }
```

---

## Future Enhancements
- Multi-language support
- Competitor analysis (compare multiple websites)
- Content gap analysis
- SERP analysis integration
- Automated content brief generation
- Integration with CMS platforms
- Scheduled monitoring and alerts
- Historical trend analysis

---

## Estimated Timeline
- Phase 1: 2-3 days
- Phase 2: 3-4 days
- Phase 3: 4-5 days
- Phase 4: 3-4 days
- Phase 5: 2-3 days
- Phase 6: 2-3 days

**Total**: ~3-4 weeks for MVP

---

## Success Metrics
- Successfully scan and extract keywords from 95%+ of websites
- Generate meaningful topic clusters with 80%+ relevance
- API response time < 30 seconds for typical website
- User satisfaction with keyword suggestions
- Cluster accuracy validated against manual research
