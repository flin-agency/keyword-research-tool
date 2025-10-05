// API Configuration Management
const API_SETTINGS_KEY = 'keywordResearchAPISettings';

// Load API settings from localStorage
function loadAPISettings() {
  const saved = localStorage.getItem(API_SETTINGS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved settings:', e);
    }
  }
  return {};
}

// Save API settings to localStorage
function saveAPISettings(settings) {
  localStorage.setItem(API_SETTINGS_KEY, JSON.stringify(settings));
}

// Check API configuration status
async function checkAPIStatus() {
  try {
    const response = await fetch('/health');
    const data = await response.json();
    return data.services || {};
  } catch (error) {
    console.error('Failed to check API status:', error);
    return {};
  }
}

// Update API status badges
async function updateAPIStatusBadges() {
  const status = await checkAPIStatus();

  const googleAdsStatus = document.getElementById('googleAdsStatus');
  const geminiStatus = document.getElementById('geminiStatus');
  const apiWarning = document.getElementById('apiWarning');

  if (status.googleAds) {
    googleAdsStatus.textContent = 'Configured';
    googleAdsStatus.className = 'api-status configured';
  } else {
    googleAdsStatus.textContent = 'Not Configured';
    googleAdsStatus.className = 'api-status not-configured';
  }

  if (status.geminiAI) {
    geminiStatus.textContent = 'Configured';
    geminiStatus.className = 'api-status configured';
  } else {
    geminiStatus.textContent = 'Not Configured';
    geminiStatus.className = 'api-status not-configured';
  }

  // Show/hide warning banner
  if (!status.googleAds) {
    apiWarning.classList.add('visible');
  } else {
    apiWarning.classList.remove('visible');
  }
}

// Initialize settings modal
function initSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const settingsBtn = document.getElementById('settingsBtn');
  const closeModal = document.getElementById('closeModal');
  const cancelSettings = document.getElementById('cancelSettings');
  const saveSettings = document.getElementById('saveSettings');
  const testConnection = document.getElementById('testConnection');

  // Load saved settings into form
  const settings = loadAPISettings();
  if (settings.googleAds) {
    document.getElementById('developerToken').value = settings.googleAds.developerToken || '';
    document.getElementById('clientId').value = settings.googleAds.clientId || '';
    document.getElementById('clientSecret').value = settings.googleAds.clientSecret || '';
    document.getElementById('refreshToken').value = settings.googleAds.refreshToken || '';
    document.getElementById('loginCustomerId').value = settings.googleAds.loginCustomerId || '';
  }
  if (settings.gemini) {
    document.getElementById('geminiApiKey').value = settings.gemini.apiKey || '';
  }

  // Open modal
  settingsBtn.addEventListener('click', () => {
    modal.classList.add('active');
    updateAPIStatusBadges();
  });

  // Close modal
  closeModal.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  cancelSettings.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  // Save settings
  saveSettings.addEventListener('click', async () => {
    const newSettings = {
      googleAds: {
        developerToken: document.getElementById('developerToken').value.trim(),
        clientId: document.getElementById('clientId').value.trim(),
        clientSecret: document.getElementById('clientSecret').value.trim(),
        refreshToken: document.getElementById('refreshToken').value.trim(),
        loginCustomerId: document.getElementById('loginCustomerId').value.trim().replace(/-/g, ''),
      },
      gemini: {
        apiKey: document.getElementById('geminiApiKey').value.trim(),
      }
    };

    // Save to localStorage
    saveAPISettings(newSettings);

    // Update environment variables on server
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });

      if (response.ok) {
        showMessage('Settings saved successfully! Server will restart to apply changes.', 'success');
        setTimeout(() => {
          modal.classList.remove('active');
          updateAPIStatusBadges();
        }, 2000);
      } else {
        showMessage('Failed to save settings. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      showMessage('Settings saved locally. Server update failed.', 'warning');
      modal.classList.remove('active');
    }
  });

  // Test connection
  testConnection.addEventListener('click', async () => {
    showMessage('Testing API connections...', 'info');

    try {
      const response = await fetch('/api/settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleAds: {
            developerToken: document.getElementById('developerToken').value.trim(),
            clientId: document.getElementById('clientId').value.trim(),
            clientSecret: document.getElementById('clientSecret').value.trim(),
            refreshToken: document.getElementById('refreshToken').value.trim(),
            loginCustomerId: document.getElementById('loginCustomerId').value.trim().replace(/-/g, ''),
          },
          gemini: {
            apiKey: document.getElementById('geminiApiKey').value.trim(),
          }
        }),
      });

      const result = await response.json();

      if (result.googleAds && result.gemini) {
        showMessage('✅ All APIs connected successfully!', 'success');
      } else {
        let message = 'Connection test results:\n';
        message += result.googleAds ? '✅ Google Ads API connected\n' : '❌ Google Ads API failed\n';
        message += result.gemini ? '✅ Gemini AI connected' : '❌ Gemini AI failed';
        showMessage(message, result.googleAds || result.gemini ? 'warning' : 'error');
      }
    } catch (error) {
      showMessage('Failed to test connection. Check your settings.', 'error');
    }
  });

  // Close modal on outside click
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.classList.remove('active');
    }
  });
}

// Show message in modal or main container
function showMessage(message, type = 'info') {
  // Check if we're in modal context
  const modal = document.querySelector('.modal.active');
  let container;

  if (modal) {
    // Create or find message container in modal
    container = modal.querySelector('.modal-message');
    if (!container) {
      container = document.createElement('div');
      container.className = 'modal-message';
      modal.querySelector('.modal-footer').insertAdjacentElement('beforebegin', container);
    }
  } else {
    container = document.getElementById('messageContainer');
  }

  if (!container) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = type === 'error' ? 'error' : type === 'success' ? 'success' : 'warning-banner visible';
  messageDiv.textContent = message;
  messageDiv.style.marginTop = '10px';

  container.innerHTML = '';
  container.appendChild(messageDiv);

  // Auto-hide after 5 seconds
  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}

// Main app functionality (from original app.js)
let currentJobId = null;
let pollInterval = null;

const urlInput = document.getElementById('urlInput');
const countrySelect = document.getElementById('countrySelect');
const languageSelect = document.getElementById('languageSelect');
const startBtn = document.getElementById('startBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const messageContainer = document.getElementById('messageContainer');
const results = document.getElementById('results');
const summary = document.getElementById('summary');
const clusters = document.getElementById('clusters');
const exportCsv = document.getElementById('exportCsv');
const exportJson = document.getElementById('exportJson');

startBtn.addEventListener('click', startResearch);
exportCsv.addEventListener('click', () => exportResults('csv'));
exportJson.addEventListener('click', () => exportResults('json'));

async function startResearch() {
  const url = urlInput.value.trim();
  const country = countrySelect.value;
  const language = languageSelect.value;

  if (!url) {
    showError('Please enter a website URL');
    return;
  }

  // Reset UI
  messageContainer.innerHTML = '';
  results.style.display = 'none';
  progressContainer.style.display = 'block';
  startBtn.disabled = true;

  try {
    // Start research job
    const response = await fetch('/api/research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, country, language }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start research');
    }

    const { job_id } = await response.json();
    currentJobId = job_id;

    // Start polling for results
    pollInterval = setInterval(() => pollJobStatus(job_id), 2000);
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

    // Update progress
    updateProgress(job.progress || 0, job.step || 'Processing...');

    // Check if job is complete
    if (job.status === 'completed') {
      clearInterval(pollInterval);
      displayResults(job.data);
      resetUI();

      // Show warnings if any
      if (job.warnings && job.warnings.length > 0) {
        job.warnings.forEach(warning => {
          showWarning(warning);
        });
      }
    } else if (job.status === 'failed') {
      clearInterval(pollInterval);
      showError(job.error || 'Research failed');
      resetUI();
    }
  } catch (error) {
    clearInterval(pollInterval);
    showError(error.message);
    resetUI();
  }
}

function updateProgress(progress, step) {
  progressFill.style.width = `${progress}%`;
  progressFill.textContent = `${progress}%`;
  progressText.textContent = step;
}

function displayResults(data) {
  if (!data) return;

  // Display summary
  summary.innerHTML = `
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

  // Display clusters
  clusters.innerHTML = '';
  if (data.clusters && data.clusters.length > 0) {
    data.clusters.forEach((cluster, index) => {
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
        ${cluster.aiDescription ? `<p style="margin: 10px 0; color: #666;">${cluster.aiDescription}</p>` : ''}
        ${cluster.aiContentStrategy ? `<p style="margin: 10px 0; color: #667eea; font-style: italic;">Strategy: ${cluster.aiContentStrategy}</p>` : ''}
        <div id="cluster-${index}" style="display: none;">
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
      clusters.appendChild(clusterDiv);
    });
  }

  results.style.display = 'block';
}

function toggleCluster(index) {
  const clusterContent = document.getElementById(`cluster-${index}`);
  if (clusterContent) {
    clusterContent.style.display = clusterContent.style.display === 'none' ? 'block' : 'none';
  }
}

async function exportResults(format) {
  if (!currentJobId) return;

  try {
    const response = await fetch(`/api/research/${currentJobId}/export?format=${format}`);
    if (!response.ok) {
      throw new Error('Failed to export results');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keywords-${currentJobId.slice(0, 8)}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    showError(error.message);
  }
}

function showError(message) {
  messageContainer.innerHTML = `<div class="error">${message}</div>`;
}

function showWarning(message) {
  const warning = document.createElement('div');
  warning.className = 'warning-banner visible';
  warning.textContent = `⚠️ ${message}`;
  warning.style.marginTop = '10px';
  messageContainer.appendChild(warning);
}

function resetUI() {
  startBtn.disabled = false;
  progressContainer.style.display = 'none';
  updateProgress(0, 'Ready');
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initSettingsModal();
  updateAPIStatusBadges();

  // Check API status periodically
  setInterval(updateAPIStatusBadges, 30000);
});

// Make toggle function global
window.toggleCluster = toggleCluster;