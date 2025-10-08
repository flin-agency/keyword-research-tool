# Quick Start

Follow these steps to spin up the backend API and frontend UI.

## 1. Prerequisites

- Node.js 16+
- Python 3.8+
- (Optional) Google Ads and Gemini credentials if you want live enrichment

## 2. Install

```bash
git clone https://github.com/flin-agency/keyword-research-tool.git
cd keyword-research-tool
npm install
cd python-ads-service && pip3 install -r requirements.txt && cd ..
npx playwright install
```

## 3. Configure (once)

```bash
cp .env.example .env
cp python-ads-service/.env.example python-ads-service/.env
```

Populate credentials in the copied files when you have them. The app still runs with demo data if you leave the defaults.

## 4. Start the services

Open two terminals:

```bash
# Terminal A – Python Google Ads microservice
cd python-ads-service
python3 app.py  # listens on port 5001 by default

# Terminal B – Node.js backend + frontend
npm run start:improved  # serves the API and UI on http://localhost:3000
```

That’s it—visit **http://localhost:3000** to use the tool.
