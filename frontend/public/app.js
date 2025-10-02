const API_URL = 'http://localhost:3000/api';

let currentJobId = null;

document.getElementById('startBtn').addEventListener('click', startResearch);
document.getElementById('exportCsv').addEventListener('click', () => exportResults('csv'));
document.getElementById('exportJson').addEventListener('click', () => exportResults('json'));

async function startResearch() {
  const url = document.getElementById('urlInput').value.trim();
  const country = document.getElementById('countrySelect').value;
  const language = document.getElementById('languageSelect').value;

  if (!url) {
    showError('Please enter a URL');
    return;
  }

  // Reset UI
  document.getElementById('results').style.display = 'none';
  document.getElementById('errorContainer').innerHTML = '';
  document.getElementById('progressContainer').style.display = 'block';
  document.getElementById('startBtn').disabled = true;

  try {
    // Start research job
    const payload = { url, country };
    if (language) {
      payload.language = language;
    }

    const response = await fetch(`${API_URL}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start research');
    }

    const data = await response.json();
    currentJobId = data.job_id;

    // Poll for results
    pollJobStatus(currentJobId);
  } catch (error) {
    showError(error.message);
    document.getElementById('progressContainer').style.display = 'none';
    document.getElementById('startBtn').disabled = false;
  }
}

async function pollJobStatus(jobId) {
  try {
    const response = await fetch(`${API_URL}/research/${jobId}`);
    const job = await response.json();

    // Update progress
    updateProgress(job.progress, job.step);

    if (job.status === 'completed') {
      document.getElementById('progressContainer').style.display = 'none';
      document.getElementById('startBtn').disabled = false;
      displayResults(job.data);
    } else if (job.status === 'failed') {
      throw new Error(job.error || 'Research failed');
    } else {
      // Continue polling
      setTimeout(() => pollJobStatus(jobId), 2000);
    }
  } catch (error) {
    showError(error.message);
    document.getElementById('progressContainer').style.display = 'none';
    document.getElementById('startBtn').disabled = false;
  }
}

function updateProgress(percent, step) {
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');

  fill.style.width = `${percent}%`;
  fill.textContent = `${percent}%`;
  text.textContent = step;
}

function displayResults(data) {
  document.getElementById('results').style.display = 'block';

  // Display summary
  const summary = document.getElementById('summary');
  summary.innerHTML = `
    <div class="stat-card">
      <div class="number">${data.totalKeywords}</div>
      <div class="label">Total Keywords</div>
    </div>
    <div class="stat-card">
      <div class="number">${data.totalClusters}</div>
      <div class="label">Topic Clusters</div>
    </div>
    <div class="stat-card">
      <div class="number">${formatNumber(data.totalSearchVolume)}</div>
      <div class="label">Total Search Volume</div>
    </div>
    <div class="stat-card">
      <div class="number">${data.scrapedContent.pages.length || data.scrapedContent.pages}</div>
      <div class="label">Pages Scanned</div>
    </div>
  `;

  // Display clusters
  const clusters = document.getElementById('clusters');
  clusters.innerHTML = data.clusters.map((cluster, index) => `
    <div class="cluster">
      <div class="cluster-header" onclick="toggleCluster(${index})">
        <div>
          <div class="cluster-title">
            ${index + 1}. ${cluster.pillarTopic}
            ${cluster.aiEnhanced ? '<span style="background: linear-gradient(90deg, #667eea, #764ba2); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; margin-left: 8px;">✨ AI Enhanced</span>' : ''}
            ${cluster.aiPriority ? '<span style="background: #ff6b6b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; margin-left: 8px;">🔥 Priority</span>' : ''}
          </div>
          ${cluster.aiDescription ? `<div style="color: #666; font-size: 0.9rem; margin-top: 5px; font-style: italic;">${cluster.aiDescription}</div>` : ''}
          <div class="cluster-meta">
            <span>📊 ${formatNumber(cluster.totalSearchVolume)} searches/mo</span>
            <span>🎯 ${cluster.keywords.length} keywords</span>
            <span>💎 Score: ${cluster.clusterValueScore.toFixed(1)}/100</span>
          </div>
          ${cluster.aiContentStrategy ? `<div style="background: #f0f7ff; padding: 10px; border-radius: 6px; margin-top: 10px; font-size: 0.85rem;"><strong>📝 Content Strategy:</strong> ${cluster.aiContentStrategy}</div>` : ''}
        </div>
        <div class="cluster-badge">${cluster.avgCompetition.toUpperCase()}</div>
      </div>
      <table class="keywords-table" id="cluster-${index}">
        <thead>
          <tr>
            <th>Keyword</th>
            <th>Search Volume</th>
            <th>Competition</th>
            <th>CPC Range</th>
          </tr>
        </thead>
        <tbody>
          ${cluster.keywords.slice(0, 10).map(kw => `
            <tr>
              <td>${kw.keyword}</td>
              <td>${formatNumber(kw.searchVolume)}</td>
              <td><span class="competition-badge competition-${kw.competition}">${kw.competition.toUpperCase()}</span></td>
              <td>$${kw.cpc.toFixed(2)} - $${kw.cpcHigh.toFixed(2)}</td>
            </tr>
          `).join('')}
          ${cluster.keywords.length > 10 ? `
            <tr>
              <td colspan="4" style="text-align: center; color: #666;">
                + ${cluster.keywords.length - 10} more keywords
              </td>
            </tr>
          ` : ''}
        </tbody>
      </table>
    </div>
  `).join('');
}

function toggleCluster(index) {
  const table = document.getElementById(`cluster-${index}`);
  table.style.display = table.style.display === 'none' ? 'table' : 'none';
}

async function exportResults(format) {
  if (!currentJobId) return;

  try {
    const response = await fetch(`${API_URL}/research/${currentJobId}/export?format=${format}`);

    if (!response.ok) {
      throw new Error('Export failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keywords-${currentJobId}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    showError(error.message);
  }
}

function showError(message) {
  const container = document.getElementById('errorContainer');
  container.innerHTML = `<div class="error">${message}</div>`;
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
