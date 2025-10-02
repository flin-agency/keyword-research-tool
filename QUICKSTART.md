# Quick Start Guide

Get up and running in 60 seconds!

## 1. Start the Server

```bash
npm start
```

You should see:
```
Server running on port 3000
```

## 2. Open the Web Interface

Open your browser to: **http://localhost:3000**

## 3. Try It Out

1. Enter a website URL in the input field:
   - `github.com`
   - `stackoverflow.com`
   - `reddit.com`
   - Any website you want to analyze

2. Click **"Start Research"**

3. Watch the progress bar as it:
   - Scans the website (0-40%)
   - Extracts keywords (40-50%)
   - Queries keyword data (50-80%)
   - Builds topic clusters (80-100%)

4. View your results:
   - Summary statistics at the top
   - Topic clusters ranked by value
   - Click cluster headers to expand/collapse
   - Keywords with search volume, competition, and CPC

5. Export results:
   - Click **"Export CSV"** for spreadsheet
   - Click **"Export JSON"** for raw data

## Expected Results

- **Total Keywords**: 200-500
- **Topic Clusters**: 5-15
- **Processing Time**: 1-2 minutes

## Note About Google Ads API

This tool works **without** Google Ads API credentials by using realistic mock data.

To use real Google Ads data:
1. Set up Google Ads API credentials (see README.md)
2. Add credentials to `.env` file
3. Restart the server

## Troubleshooting

### Server won't start
```bash
# Kill any process using port 3000
lsof -ti:3000 | xargs kill -9

# Try again
npm start
```

### Website scraping fails
- Try a different website
- Some websites block automated scraping
- The tool will still work, it just needs an accessible website

### Need help?
Check the full **README.md** for detailed documentation.

---

**That's it! You're ready to discover keyword opportunities.** 🚀
