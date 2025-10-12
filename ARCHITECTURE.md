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
│  │  │ (Playwright)│  │  Extractor   │  │      API       │  │  │
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
│  │   Website    │   │   (optional)     │   │ (Playwright) │   │
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
   └─> Launch Playwright (headless browser) or Axios fallback
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

### 1. Scraper Module (`scraper-unified.js`)

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

**Technologies**: Playwright, Axios, Cheerio

---

### 2. Gemini Keyword Intelligence (`gemini.js`)

**Purpose**: Generate multilingual, marketing-grade seed keywords and enhance topic clusters.

**Input**: Scraped content object and language metadata

**Output**:
- Array of keyword strings (max 150)
- Optional cluster enrichment (pillar topic, description, strategy)

**Key Functions**:
- `extractKeywordsWithAI(scrapedContent, maxKeywords, language)` - Prompt Gemini for localized keyword ideas.
- `enhanceClusterWithAI(cluster, websiteContext, language)` - Rename and describe clusters in the requested language.
- `analyzeAndRegroupClusters(clusters, websiteContext, keywords, language)` - Suggest cluster regrouping.

**Technologies**: Google Gemini API, custom language utilities

---

### 3. Google Ads Bridge (`google-ads-python.js`)

**Purpose**: Retrieve real search metrics for AI-generated keywords.

**Input**: Array of keyword strings, target country, language code

**Output**:
```javascript
[
  {
    keyword: string,
    searchVolume: number,
    competition: "low" | "medium" | "high",
    cpc: number,
    cpcHigh: number
  }
]
```

**Key Functions**:
- `getKeywordMetrics(keywords, country, language)` - Proxy request to the Python Google Ads service.
- `normalizeKeywordResponse(data)` - Standardize Ads metrics for clustering.

**Technologies**: Axios HTTP client, Python Ads microservice (Google Ads official SDK)

---

### 4. Clustering Engine (`clustering-improved.js`)

**Purpose**: Group enriched keywords into meaningful topic clusters with AI insights.

**Input**: Keyword metric objects, website context, language metadata

**Output**:
```javascript
[
  {
    id: string,
    pillarTopic: string,
    keywords: KeywordMetric[],
    totalSearchVolume: number,
    avgCompetition: string,
    clusterValueScore: number,
    aiDescription?: string,
    aiContentStrategy?: string,
    aiEnhanced?: boolean
  }
]
```

**Key Functions**:
- `clusterKeywords(data, websiteContext, options)` - Hybrid pipeline (K-Means, DBSCAN, semantic grouping).
- `enrichClusterWithGemini(cluster, context, language)` - Localize descriptions and strategies.
- `scoreCluster(cluster)` - Compute opportunity and priority metrics.

**Technologies**: density-clustering, ml-kmeans, cosine similarity, Google Gemini

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
- Playwright browser sandboxing

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

### Current Status
- Legacy Jest suites covering the deprecated pipeline have been removed.
- Remaining automated tests: `scraper.test.js`, `exporter.test.js`.
- New integration tests should target `research`, `clustering-improved`, and Gemini-assisted flows.

### Recommended Test Types
- **Unit Tests**: Language utilities, Gemini prompt builders, clustering helpers.
- **Integration Tests**: Full research job workflow with mocked Google Ads service.
- **API Contract Tests**: `/api/research` happy-path and error scenarios.

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
