const state = {
  currentJobId: null,
  pollInterval: null,
};

const elements = {
  urlInput: document.getElementById('urlInput'),
  countrySelect: document.getElementById('countrySelect'),
  languageSelect: document.getElementById('languageSelect'),
  startBtn: document.getElementById('startBtn'),
  progressContainer: document.getElementById('progressContainer'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  messageContainer: document.getElementById('messageContainer'),
  results: document.getElementById('results'),
  summary: document.getElementById('summary'),
  clusters: document.getElementById('clusters'),
  exportCsv: document.getElementById('exportCsv'),
  exportJson: document.getElementById('exportJson'),
};

function getSelectedLanguageLabel() {
  const { languageSelect } = elements;
  if (!languageSelect) return '';
  const option = languageSelect.options[languageSelect.selectedIndex];
  return option?.dataset?.label || option?.textContent || '';
}

async function startResearch() {
  const url = elements.urlInput.value.trim();
  const country = elements.countrySelect.value;
  const language = elements.languageSelect.value;
  const languageLabel = getSelectedLanguageLabel();

  if (!url) {
    showError('Please enter a website URL');
    return;
  }

  resetMessages();
  elements.results.style.display = 'none';
  elements.progressContainer.style.display = 'block';
  elements.startBtn.disabled = true;
  updateProgress(5, 'Starting research...');

  try {
    const response = await fetch('/api/research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, country, language, languageLabel }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to start research');
    }

    const { job_id: jobId } = await response.json();
    state.currentJobId = jobId;

    if (state.pollInterval) {
      clearInterval(state.pollInterval);
    }

    state.pollInterval = setInterval(() => pollJobStatus(jobId), 2000);
  } catch (error) {
    showError(error.message);
    resetUI();
  }
}

async function pollJobStatus(jobId) {
  try {
    const response = await fetch(`/api/research/${jobId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch job status');
    }

    const job = await response.json();
    updateProgress(job.progress || 0, job.step || 'Processing...');

    if (job.status === 'completed') {
      clearInterval(state.pollInterval);
      displayResults(job.data);
      resetUI();

      (job.warnings || []).forEach((warning) => showWarning(warning));
    } else if (job.status === 'failed') {
      clearInterval(state.pollInterval);
      showError(job.error || 'Research failed');
      resetUI();
    }
  } catch (error) {
    clearInterval(state.pollInterval);
    showError(error.message);
    resetUI();
  }
}

function updateProgress(progress, step) {
  elements.progressFill.style.width = `${progress}%`;
  elements.progressFill.textContent = `${progress}%`;
  elements.progressText.textContent = step;
}

function displayResults(data) {
  if (!data) return;

  elements.summary.innerHTML = `
    <div class="stat-card">
      <div class="number">${data.totalKeywords?.toLocaleString() || 0}</div>
      <div class="label">Total Keywords</div>
    </div>
    <div class="stat-card">
      <div class="number">${data.totalClusters?.toLocaleString() || 0}</div>
      <div class="label">Topic Clusters</div>
    </div>
    <div class="stat-card">
      <div class="number">${data.totalSearchVolume?.toLocaleString() || 0}</div>
      <div class="label">Total Search Volume</div>
    </div>
    <div class="stat-card">
      <div class="number">${data.country || 'N/A'}</div>
      <div class="label">Target Market</div>
    </div>
  `;

  elements.clusters.innerHTML = '';
  (data.clusters || []).forEach((cluster, index) => {
    const clusterDiv = document.createElement('div');
    clusterDiv.className = 'cluster';
    clusterDiv.innerHTML = `
      <div class="cluster-header" onclick="toggleCluster(${index})">
        <div class="cluster-title">${cluster.pillarTopic}</div>
        <div class="cluster-badge">${cluster.keywords?.length || 0} keywords</div>
      </div>
      <div class="cluster-meta">
        <span>📊 Volume: ${cluster.totalSearchVolume?.toLocaleString() || 0}</span>
        <span>🎯 Competition: ${cluster.avgCompetition || 'N/A'}</span>
        <span>💯 Score: ${cluster.clusterValueScore || 0}</span>
      </div>
      ${cluster.aiDescription ? `<div class="cluster-description">${cluster.aiDescription}</div>` : ''}
      ${cluster.aiContentStrategy ? `<div class="cluster-strategy">✨ <strong>Content Strategy:</strong> ${cluster.aiContentStrategy}</div>` : ''}
      <div id="cluster-${index}" class="cluster-details" style="display: none;">
        <table class="keywords-table">
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Search Volume</th>
              <th>Competition</th>
              <th>CPC</th>
            </tr>
          </thead>
          <tbody>
            ${(cluster.keywords || [])
              .slice(0, 10)
              .map(
                (kw) => `
              <tr>
                <td>${kw.keyword}</td>
                <td>${kw.searchVolume?.toLocaleString() || 0}</td>
                <td><span class="competition-badge competition-${kw.competition}">${kw.competition}</span></td>
                <td>$${kw.cpc?.toFixed(2) || '0.00'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        ${cluster.keywords?.length > 10 ? `<p style="margin-top: 10px; color: #666;">... and ${cluster.keywords.length - 10} more keywords</p>` : ''}
      </div>
    `;

    elements.clusters.appendChild(clusterDiv);
  });

  elements.results.style.display = 'block';
}

function toggleCluster(index) {
  const content = document.getElementById(`cluster-${index}`);
  if (content) {
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
  }
}

async function exportResults(format) {
  if (!state.currentJobId) return;

  try {
    const response = await fetch(`/api/research/${state.currentJobId}/export?format=${format}`);
    if (!response.ok) {
      throw new Error('Failed to export results');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `keywords-${state.currentJobId.slice(0, 8)}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    showError(error.message);
  }
}

function showError(message) {
  if (!elements.messageContainer) return;
  elements.messageContainer.innerHTML = `<div class="error">${message}</div>`;
}

function showWarning(message) {
  if (!elements.messageContainer) return;
  const warning = document.createElement('div');
  warning.className = 'warning-banner visible';
  warning.textContent = `⚠️ ${message}`;
  warning.style.marginTop = '10px';
  elements.messageContainer.appendChild(warning);
}

function resetMessages() {
  if (elements.messageContainer) {
    elements.messageContainer.innerHTML = '';
  }
}

function resetUI() {
  elements.startBtn.disabled = false;
  elements.progressContainer.style.display = 'none';
  updateProgress(0, 'Ready');
}

document.addEventListener('DOMContentLoaded', () => {
  if (elements.startBtn) {
    elements.startBtn.addEventListener('click', startResearch);
  }

  if (elements.exportCsv) {
    elements.exportCsv.addEventListener('click', () => exportResults('csv'));
  }

  if (elements.exportJson) {
    elements.exportJson.addEventListener('click', () => exportResults('json'));
  }

  updateProgress(0, 'Ready');
});

window.toggleCluster = toggleCluster;
