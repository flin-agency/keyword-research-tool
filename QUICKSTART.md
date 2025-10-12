# Quick Start Guide (Latest Stack)

Spin up the improved keyword research pipeline end-to-end.

## 1. Requirements

- **Node.js 18+** and npm
- **Python 3.10+** (needed for live Google Ads data)
- Ability to install [Playwright browsers](https://playwright.dev/docs/intro)
- Optional API keys:
  - Google Ads developer credentials
  - Gemini API key

> ⚠️ No credentials? The app still works with high-quality demo data, so you can explore the workflow without provisioning APIs.

## 2. Install Dependencies

```bash
git clone https://github.com/flin-agency/keyword-research-tool.git
cd keyword-research-tool

# Node.js dependencies
npm install

# Playwright browser binaries (Chromium is enough)
npx playwright install chromium

# Python microservice dependencies
cd python-ads-service
pip3 install -r requirements.txt
cd ..
```

## 3. Configure the Environment

```bash
cp .env.example .env
```

Fill in the `.env` file with any API credentials you have available. The same file powers both the Node.js server and the Python microservice, so you only need to maintain it once.

Minimum configuration for a demo run:
- Keep Google Ads + Gemini variables empty to use realistic mock data.
- Optionally tweak crawling limits like `MAX_PAGES_TO_SCAN` or `MAX_KEYWORDS`.

## 4. Start the Services

Run the Python helper (only required for real Google Ads lookups):

```bash
cd python-ads-service
PYTHON_SERVICE_PORT=5001 python3 app.py
```

Then launch the Node.js server in a second terminal:

```bash
cd keyword-research-tool
npm start
```

When the logs show `Ready at http://localhost:3000`, open that URL in your browser.

## 5. Run a Research Job

1. Enter any website URL (e.g. `https://flin.agency/`).
2. Choose the target country and language.
3. Click **Start Research**.
4. Watch the live progress as the system scrapes, extracts AI keywords, enriches Google Ads metrics, and builds topic clusters.
5. Expand cluster cards to explore keywords and export them as CSV or JSON.

## 6. Health Check & Troubleshooting

- **Server health:** `curl http://localhost:3000/health`
- **Playwright missing?** Re-run `npx playwright install chromium`.
- **Port busy?** Stop other services or change `PORT` in `.env`.
- **Skipping Google Ads service?** Just leave the Python helper stopped—the Node.js API will automatically fall back to demo metrics.

For advanced configuration, testing, and API details, read the full [README.md](README.md).

---

**Happy researching! 🚀**
