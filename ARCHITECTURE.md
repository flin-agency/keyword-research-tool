# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             Web Interface (index.html)                    │  │
│  │  • URL Input Form                                         │  │
│  │  • Progress Tracking                                      │  │
│  │  • Results Display                                        │  │
│  │  • Export Buttons                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↕ HTTP/REST API                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER (Node.js)                      │
│                         Port 3000                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   API Layer                               │  │
│  │                                                           │  │
│  │  POST /api/research        → Create job                  │  │
│  │  GET  /api/research/:id    → Get status                  │  │
│  │  GET  /api/research/:id/export → Export results          │  │
│  │  GET  /health              → Health check                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Service Layer (Modules)                      │  │
│  │                                                           │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌────────────────┐  │  │
│  │  │  Scraper   │→ │   Keyword    │→ │  Google Ads    │  │  │
│  │  │ (Puppeteer)│  │  Extractor   │  │      API       │  │  │
│  │  └────────────┘  │   (NLP)      │  │  (or Mock)     │  │  │
│  │                  └──────────────┘  └────────────────┘  │  │
│  │                         ↓                    ↓            │  │
│  │                  ┌──────────────────────────────┐        │  │
│  │                  │      Clustering              │        │  │
│  │                  │    (ML K-Means)              │        │  │
│  │                  └──────────────────────────────┘        │  │
│  │                         ↓                                  │  │
│  │                  ┌──────────────┐                         │  │
│  │                  │   Exporter   │                         │  │
│  │                  │  (CSV/JSON)  │                         │  │
│  │                  └──────────────┘                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           In-Memory Job Storage (Map)                     │  │
│  │  • Job ID → Status, Progress, Results                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    External Dependencies                         │
│                                                                  │
│  ┌──────────────┐   ┌──────────────────┐   ┌──────────────┐   │
│  │   Target     │   │  Google Ads API  │   │  Chromium    │   │
│  │   Website    │   │   (optional)     │   │  (Puppeteer) │   │
│  └──────────────┘   └──────────────────┘   └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Complete Research Flow

```
1. User Input
   └─> URL entered in browser
       ↓

2. Job Creation
   └─> POST /api/research
       └─> Generate UUID
       └─> Store job in memory
       └─> Start async processing
       ↓

3. Website Scraping
   └─> Launch Puppeteer (headless browser)
       └─> Visit homepage
       └─> Extract: titles, headings, paragraphs, meta, alt text
       └─> Follow internal links (max 20 pages)
       └─> Return scraped content
       ↓

4. Keyword Extraction
   └─> Tokenize text
       └─> Remove stop words
       └─> POS tagging (nouns, verbs, adjectives)
       └─> Extract 2-4 word phrases
       └─> Calculate TF-IDF scores
       └─> Return top 200 seed keywords
       ↓

5. Google Ads Query
   └─> Batch keywords (50 per request)
       └─> For each batch:
           ├─> Query Keyword Planner API
           ├─> Get search volume
           ├─> Get competition level
           ├─> Get CPC data
           └─> Get related keywords
       └─> Expand to 200-500 keywords
       └─> Return keyword metrics
       ↓

6. Topic Clustering
   └─> Vectorize keywords (TF-IDF)
       └─> Apply K-Means clustering
       └─> Group into 5-15 clusters
       └─> Calculate cluster metrics:
           ├─> Total search volume
           ├─> Average competition
           └─> Value score (0-100)
       └─> Identify pillar topics
       └─> Rank clusters by value
       ↓

7. Results Storage
   └─> Update job status to "completed"
       └─> Store results in job data
       └─> Include clusters, keywords, metrics
       ↓

8. Results Display
   └─> Browser polls GET /api/research/:id
       └─> Receive complete data
       └─> Render UI:
           ├─> Summary stats
           ├─> Cluster cards
           ├─> Keyword tables
           └─> Export buttons
```

## Module Responsibilities

### 1. Scraper Module (`scraper.js`)

**Purpose**: Extract content from websites

**Input**: URL string

**Output**:
```javascript
{
  pages: [{
    url: string,
    title: string,
    metaDescription: string,
    headings: { h1: [], h2: [], h3: [] },
    paragraphs: [],
    links: [],
    images: [],
    wordCount: number
  }],
  totalWords: number
}
```

**Key Functions**:
- `scrapeWebsite(url)` - Main scraping function
- `extractContentFromHTML(html, url)` - Parse HTML with Cheerio
- `validateUrl(url)` - Check if URL is accessible

**Technologies**: Puppeteer, Cheerio

---

### 2. Keyword Extractor Module (`keyword-extractor.js`)

**Purpose**: Extract relevant keywords using NLP

**Input**: Scraped content object

**Output**: Array of keyword strings

**Key Functions**:
- `extractKeywords(content)` - Main extraction function
- `extractSingleKeywords(texts)` - Extract nouns/verbs/adjectives
- `extractPhrases(texts)` - Extract 2-4 word phrases
- `calculateRelevanceScore(keyword)` - TF-IDF based scoring

**Technologies**: Natural, Compromise, Stopword

---

### 3. Google Ads Module (`google-ads.js`)

**Purpose**: Get keyword metrics from Google Ads API

**Input**: Array of seed keywords

**Output**:
```javascript
[{
  keyword: string,
  searchVolume: number,
  competition: "low" | "medium" | "high",
  cpc: number,
  cpcHigh: number
}]
```

**Key Functions**:
- `getKeywordMetrics(seeds)` - Query real API
- `getMockKeywordData(seeds)` - Generate mock data
- `initializeClient()` - Set up API client

**Technologies**: google-ads-api

---

### 4. Clustering Module (`clustering.js`)

**Purpose**: Group keywords into topic clusters

**Input**: Array of keyword objects with metrics

**Output**:
```javascript
[{
  id: number,
  pillarTopic: string,
  keywords: [],
  totalSearchVolume: number,
  avgCompetition: string,
  clusterValueScore: number
}]
```

**Key Functions**:
- `clusterKeywords(data)` - Main clustering function
- `vectorizeKeywords(data)` - Convert to TF-IDF vectors
- `calculateClusterValue(keywords)` - Score clusters
- `calculateSimilarity(kw1, kw2)` - Semantic similarity

**Technologies**: ml-kmeans, Natural (TF-IDF)

---

### 5. Exporter Module (`exporter.js`)

**Purpose**: Export results to various formats

**Input**: Research data object

**Output**: CSV or JSON string

**Key Functions**:
- `toCSV(data)` - Convert to CSV format

**Technologies**: json2csv

---

### 6. Research API (`research.js`)

**Purpose**: REST API endpoints and orchestration

**Endpoints**:
- `POST /api/research` - Create research job
- `GET /api/research/:jobId` - Get job status
- `GET /api/research/:jobId/export` - Export results

**Key Functions**:
- `processResearch(jobId, url)` - Async orchestration

**Storage**: In-memory Map (jobs)

---

## State Management

### Job States

```javascript
{
  id: "uuid",
  url: "https://example.com",
  status: "processing" | "completed" | "failed",
  progress: 0-100,
  step: "scanning" | "extracting" | "querying" | "clustering" | "completed",
  createdAt: Date,
  completedAt: Date,
  error: string | null,
  data: {
    totalKeywords: number,
    totalClusters: number,
    totalSearchVolume: number,
    clusters: [],
    scrapedContent: {}
  }
}
```

### Progress Tracking

| Step | Progress % | Description |
|------|-----------|-------------|
| Initializing | 0-10 | Job created |
| Scanning | 10-40 | Scraping website |
| Extracting | 40-50 | NLP keyword extraction |
| Querying API | 50-80 | Google Ads API calls |
| Clustering | 80-100 | ML clustering |
| Completed | 100 | Results ready |

---

## Scalability Considerations

### Current Architecture
- **Concurrency**: Supports 10+ simultaneous users
- **Storage**: In-memory (ephemeral)
- **Processing**: Async/await, non-blocking

### Production Improvements
- **Database**: Replace Map with Redis/MongoDB
- **Queue**: Add job queue (Bull, BullMQ)
- **Caching**: Cache keyword data (1 day TTL)
- **Rate Limiting**: Protect API endpoints
- **Load Balancing**: Multiple server instances
- **Monitoring**: Logging, metrics, alerts

---

## Security

### Current Protections
- Input validation (URL format)
- CORS enabled
- Environment variables for secrets
- No user data persistence
- Puppeteer sandboxing

### Production Additions
- HTTPS enforcement
- Rate limiting per IP
- API authentication
- Request size limits
- Security headers (helmet)
- Input sanitization (XSS protection)

---

## Error Handling

### Levels
1. **API Layer**: HTTP status codes, error messages
2. **Service Layer**: Try/catch, graceful degradation
3. **Client Layer**: User-friendly error display

### Fallback Strategy
```
Google Ads API Error
    ↓
Retry (3 attempts)
    ↓
Fall back to mock data
    ↓
Continue processing
```

---

## Performance

### Optimizations
- Parallel API requests (batching)
- Limit pages scraped (20 max)
- Limit keywords returned (500 max)
- Efficient clustering (K-Means++)
- Static file caching

### Bottlenecks
1. **Website scraping**: 30-60 seconds
2. **Google Ads API**: 20-40 seconds
3. **Clustering**: 5-10 seconds

**Total**: ~1-2 minutes

---

## Testing Architecture

### Test Suites (6)
1. `api.test.js` - API endpoints
2. `scraper.test.js` - HTML parsing
3. `keyword-extractor.test.js` - NLP extraction
4. `google-ads.test.js` - API mocking
5. `clustering.test.js` - ML algorithms
6. `exporter.test.js` - Data export

### Test Types
- **Unit Tests**: Individual functions
- **Integration Tests**: Module interactions
- **API Tests**: HTTP endpoints
- **Mock Tests**: External dependencies

### Coverage
- **Total**: 67.21%
- **Critical Modules**: 97-100%
- **API Wrappers**: 40-50% (adequate)

---

## Deployment

### Requirements
- Node.js 18+
- 2GB RAM minimum
- Port 3000 available
- Internet access (for scraping)

### Environment Variables
```bash
PORT=3000
NODE_ENV=production
MAX_PAGES_TO_SCAN=20
MAX_KEYWORDS=500
GOOGLE_ADS_* (optional)
```

### Process Management
```bash
# Development
npm run dev

# Production
npm start

# With PM2
pm2 start backend/server.js --name keyword-tool
```

---

## Monitoring

### Health Check
```bash
GET /health
→ { status: "ok", timestamp: "..." }
```

### Logs
- Job creation
- Processing steps
- API calls
- Errors

### Metrics to Track
- Jobs per hour
- Success/failure rate
- Average processing time
- API usage
- Error rates

---

**Architecture designed for reliability, scalability, and maintainability.**
