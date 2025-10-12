const state = {
  currentJobId: null,
  pollInterval: null,
  googleAuthStatus: null,
  apiInfo: null,
  showIntegrationSettings: false,
  showCrawlSettings: false,
};

const elements = {
  urlInput: document.getElementById('urlInput'),
  countrySelect: document.getElementById('countrySelect'),
  languageSelect: document.getElementById('languageSelect'),
  startBtn: document.getElementById('startBtn'),
  maxPagesInput: document.getElementById('maxPagesInput'),
  followLinksCheckbox: document.getElementById('followLinksCheckbox'),
  progressContainer: document.getElementById('progressContainer'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  messageContainer: document.getElementById('messageContainer'),
  results: document.getElementById('results'),
  summary: document.getElementById('summary'),
  clusters: document.getElementById('clusters'),
  contentUrls: document.getElementById('contentUrls'),
  crawledUrlsToggle: document.getElementById('crawledUrlsToggle'),
  exportCsv: document.getElementById('exportCsv'),
  exportJson: document.getElementById('exportJson'),
  apiWarning: document.getElementById('apiWarning'),
  googleStatusBadge: document.getElementById('googleStatusBadge'),
  googleStatusHint: document.getElementById('googleStatusHint'),
  connectGoogleBtn: document.getElementById('connectGoogleBtn'),
  refreshStatusBtn: document.getElementById('refreshStatusBtn'),
  integrationCard: document.getElementById('integrationCard'),
  integrationSummary: document.getElementById('integrationSummary'),
  integrationSummaryBadge: document.getElementById('integrationSummaryBadge'),
  integrationSummaryText: document.getElementById('integrationSummaryText'),
  showIntegrationSettingsBtn: document.getElementById('showIntegrationSettingsBtn'),
  hideIntegrationSettingsBtn: document.getElementById('hideIntegrationSettingsBtn'),
  refreshStatusSummaryBtn: document.getElementById('refreshStatusSummaryBtn'),
  crawlOptions: document.getElementById('crawlOptions'),
  toggleCrawlSettingsBtn: document.getElementById('toggleCrawlSettingsBtn'),
};

const textEscaper = typeof document !== 'undefined' ? document.createElement('div') : null;

function escapeHtml(value) {
  if (!textEscaper) {
    return typeof value === 'string' ? value : '';
  }

  textEscaper.textContent = typeof value === 'string' ? value : '';
  return textEscaper.innerHTML;
}

function getSelectedLanguageLabel() {
  const { languageSelect } = elements;
  if (!languageSelect) return '';
  const option = languageSelect.options[languageSelect.selectedIndex];
  return option?.dataset?.label || option?.textContent || '';
}

function getCrawlOptions() {
  const options = {};

  if (elements.maxPagesInput) {
    const parsed = parseInt(elements.maxPagesInput.value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      const clamped = Math.min(parsed, 100);
      options.maxPages = clamped;
      if (clamped !== parsed) {
        elements.maxPagesInput.value = clamped;
      }
    }
  }

  if (elements.followLinksCheckbox) {
    options.followLinks = elements.followLinksCheckbox.checked;
  }

  return options;
}

function safeDecode(value) {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch (error) {
    console.warn('Failed to decode parameter', value, error);
    return value;
  }
}

function isGoogleIntegrationConfigured(status) {
  return Boolean(
    status &&
      !status.error &&
      status.hasClientId &&
      status.hasClientSecret &&
      status.configured,
  );
}

function handleRedirectMessages() {
  const params = new URLSearchParams(window.location.search);
  if (!params || params.size === 0) {
    return;
  }

  const success = params.get('success');
  const error = params.get('error');
  const messageParam = params.get('message');

  if (success === 'true') {
    const message = messageParam ? safeDecode(messageParam) : 'Google account connected successfully.';
    showSuccess(message);
  } else if (error) {
    const message = safeDecode(error);
    showError(message || 'Google OAuth failed.');
  }

  if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

async function loadIntegrationStatus(showMessages = false) {
  if (!elements.googleStatusBadge) {
    return null;
  }

  try {
    const response = await fetch('/api/auth/status', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to load Google OAuth status');
    }

    const status = await response.json();
    const previousStatus = state.googleAuthStatus;
    const firstLoad = previousStatus === null;
    const wasConfigured = isGoogleIntegrationConfigured(previousStatus);
    const isConfigured = isGoogleIntegrationConfigured(status);

    state.googleAuthStatus = status;

    if (firstLoad) {
      state.showIntegrationSettings = !isConfigured;
    } else if (!wasConfigured && isConfigured) {
      state.showIntegrationSettings = false;
    }

    updateGoogleStatusDisplay(status);
    updateApiWarning();

    if (showMessages) {
      showSuccess('Integration status refreshed.');
    }

    return status;
  } catch (error) {
    console.error('Failed to load Google OAuth status:', error);
    state.googleAuthStatus = { error: error.message };
    state.showIntegrationSettings = true;
    updateGoogleStatusDisplay(state.googleAuthStatus);
    updateApiWarning();

    if (showMessages) {
      showError(`Failed to refresh integration status. ${error.message}`);
    }

    return null;
  }
}

async function loadApiInfo() {
  try {
    const response = await fetch('/api/info', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to load API information');
    }

    const info = await response.json();
    state.apiInfo = info;
    updateApiWarning();
    return info;
  } catch (error) {
    console.error('Failed to load API info:', error);
    state.apiInfo = { error: error.message };
    updateApiWarning();
    return null;
  }
}

function updateGoogleActions(status) {
  const { connectGoogleBtn } = elements;
  if (!connectGoogleBtn) {
    return;
  }

  if (!status || status.error) {
    connectGoogleBtn.disabled = true;
    connectGoogleBtn.title = status?.error ? status.error : 'Unable to verify Google OAuth status.';
    connectGoogleBtn.textContent = 'Connect Google Ads';
    return;
  }

  const missingClientConfig = !status.hasClientId || !status.hasClientSecret;
  connectGoogleBtn.disabled = missingClientConfig;
  connectGoogleBtn.title = missingClientConfig
    ? 'Add GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET to your .env file to enable OAuth.'
    : '';
  connectGoogleBtn.textContent = status.configured ? 'Reconnect Google Ads' : 'Connect Google Ads';
}

function updateGoogleStatusDisplay(status) {
  const { googleStatusBadge, googleStatusHint } = elements;
  if (!googleStatusBadge || !googleStatusHint) {
    return;
  }

  let badgeClass = 'status-indicator--unknown';
  let badgeText = 'Status unavailable';
  let hintText = 'Unable to verify Google Ads OAuth status.';

  if (status && !status.error) {
    if (!status.hasClientId || !status.hasClientSecret) {
      badgeClass = 'status-indicator--warning';
      badgeText = 'Client credentials required';
      hintText = 'Add your Google Ads OAuth client ID and secret to the server environment.';
    } else if (status.configured) {
      badgeClass = 'status-indicator--connected';
      badgeText = 'Connected';
      hintText = 'Connected. Reconnect anytime to refresh permissions.';
    } else {
      badgeClass = 'status-indicator--disconnected';
      badgeText = 'Action required';
      hintText = 'Click Connect Google Ads to authorize access and enable live metrics.';
    }
  } else if (status?.error) {
    badgeClass = 'status-indicator--unknown';
    badgeText = 'Status unavailable';
    hintText = `Failed to load status: ${status.error}`;
  }

  googleStatusBadge.className = `status-indicator ${badgeClass}`;
  googleStatusBadge.textContent = badgeText;
  googleStatusHint.textContent = hintText;

  updateGoogleActions(status);
  updateIntegrationSummary(badgeClass, badgeText, hintText, status);
}

function updateIntegrationSummary(badgeClass, badgeText, hintText, status) {
  const { integrationSummaryBadge, integrationSummaryText } = elements;

  if (integrationSummaryBadge) {
    integrationSummaryBadge.className = `status-indicator ${badgeClass}`;
    integrationSummaryBadge.textContent = badgeText;
  }

  if (integrationSummaryText) {
    integrationSummaryText.textContent = hintText;
  }

  updateIntegrationVisibility(status);
}

function updateIntegrationVisibility(status) {
  const {
    integrationCard,
    integrationSummary,
    showIntegrationSettingsBtn,
    hideIntegrationSettingsBtn,
  } = elements;

  if (!integrationCard) {
    return;
  }

  const fullyConfigured = isGoogleIntegrationConfigured(status);

  if (!fullyConfigured) {
    state.showIntegrationSettings = true;
  }

  const showCard = state.showIntegrationSettings || !fullyConfigured;
  const showSummary = fullyConfigured && !state.showIntegrationSettings;

  integrationCard.classList.toggle('hidden', !showCard);

  if (integrationSummary) {
    integrationSummary.classList.toggle('hidden', !showSummary);
  }

  if (showIntegrationSettingsBtn) {
    showIntegrationSettingsBtn.classList.toggle('hidden', !showSummary);
  }

  if (hideIntegrationSettingsBtn) {
    hideIntegrationSettingsBtn.classList.toggle('hidden', !fullyConfigured);
  }
}

function setIntegrationSettingsVisibility(visible) {
  const fullyConfigured = isGoogleIntegrationConfigured(state.googleAuthStatus);
  state.showIntegrationSettings = visible || !fullyConfigured;
  updateIntegrationVisibility(state.googleAuthStatus);
}

function setCrawlSettingsVisibility(visible) {
  state.showCrawlSettings = visible;

  if (elements.crawlOptions) {
    elements.crawlOptions.classList.toggle('hidden', !visible);
  }

  if (elements.toggleCrawlSettingsBtn) {
    elements.toggleCrawlSettingsBtn.setAttribute('aria-expanded', String(visible));
    elements.toggleCrawlSettingsBtn.textContent = visible ? 'Hide crawl settings' : 'Show crawl settings';
  }
}

function toggleCrawlSettings() {
  setCrawlSettingsVisibility(!state.showCrawlSettings);
}

function updateApiWarning() {
  const { apiWarning } = elements;
  if (!apiWarning) {
    return;
  }

  if (state.googleAuthStatus === null || state.apiInfo === null) {
    return;
  }

  const missingItems = [];

  if (state.googleAuthStatus) {
    if (state.googleAuthStatus.error) {
      missingItems.push('Google Ads OAuth status (server error)');
    } else if (!state.googleAuthStatus.hasClientId || !state.googleAuthStatus.hasClientSecret) {
      missingItems.push('Google Ads OAuth client ID/secret');
    } else if (!state.googleAuthStatus.configured) {
      missingItems.push('Google Ads authorization');
    }
  }

  if (state.apiInfo) {
    if (state.apiInfo.error) {
      missingItems.push('Gemini API status (server error)');
    } else if (!state.apiInfo.features?.aiKeywordExtraction) {
      missingItems.push('Gemini API key');
    }
  }

  if (missingItems.length === 0) {
    apiWarning.classList.remove('visible');
    apiWarning.style.display = 'none';
  } else {
    apiWarning.textContent = `⚠️ ${missingItems.join(' and ')} required for live data.`;
    apiWarning.classList.add('visible');
    apiWarning.style.display = 'block';
  }
}

async function initializeIntegrations() {
  await Promise.all([loadIntegrationStatus(), loadApiInfo()]);
}

async function startResearch() {
  const url = elements.urlInput.value.trim();
  const country = elements.countrySelect.value;
  const language = elements.languageSelect.value;
  const languageLabel = getSelectedLanguageLabel();
  const options = getCrawlOptions();

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
      body: JSON.stringify({ url, country, language, languageLabel, options }),
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

  if (elements.contentUrls) {
    if (elements.crawledUrlsToggle) {
      elements.crawledUrlsToggle.setAttribute('aria-expanded', 'false');
      elements.crawledUrlsToggle.classList.remove('is-open');
    }

    const urlsSource = Array.isArray(data.crawledUrls) && data.crawledUrls.length > 0
      ? data.crawledUrls
      : (data.scrapedContent?.pages || []).map((page) => page?.url).filter((url) => typeof url === 'string' && url.trim());

    if (!urlsSource || urlsSource.length === 0) {
      elements.contentUrls.innerHTML = '<li class="empty-state">No URLs collected.</li>';
    } else {
      elements.contentUrls.innerHTML = urlsSource
        .map((url, index) => {
          const safeLabel = escapeHtml(url);
          const safeHref = typeof url === 'string' ? encodeURI(url) : '#';
          return `
            <li class="url-item">
              <span class="url-index">${index + 1}.</span>
              <a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>
            </li>
          `;
        })
        .join('');
    }

    elements.contentUrls.classList.add('is-collapsed');
    elements.contentUrls.hidden = true;

    if (elements.crawledUrlsToggle) {
      const baseLabel = elements.crawledUrlsToggle.dataset?.label || 'Crawled URLs';
      const labelNode = elements.crawledUrlsToggle.querySelector('.toggle-label');
      if (labelNode) {
        const count = urlsSource?.length || 0;
        labelNode.textContent = `${baseLabel} (${count})`;
      }
    }
  }

  elements.clusters.innerHTML = '';
  (data.clusters || []).forEach((cluster, index) => {
    const clusterDiv = document.createElement('div');
    clusterDiv.className = 'cluster';
    clusterDiv.innerHTML = `
      <div
        class="cluster-header"
        data-cluster-index="${index}"
        aria-controls="cluster-${index}"
      >
        <div class="cluster-title-wrap">
          <div class="cluster-title">${cluster.pillarTopic}</div>
        </div>
      </div>
      ${cluster.aiDescription ? `<div class="cluster-description">${cluster.aiDescription}</div>` : ''}
      <div class="cluster-metrics">
        <span>🧮 Keywords: ${cluster.keywords?.length || 0}</span>
        <span>📊 Volume: ${cluster.totalSearchVolume?.toLocaleString() || 0}</span>
        <span>🎯 Competition: ${cluster.avgCompetition || 'N/A'}</span>
        <span>💯 Score: ${cluster.clusterValueScore || 0}</span>
      </div>
      ${cluster.aiContentStrategy ? `<div class="cluster-strategy">✨ <strong>Content Strategy:</strong> ${cluster.aiContentStrategy}</div>` : ''}
      <button
        type="button"
        class="cluster-toggle"
        data-cluster-index="${index}"
        aria-expanded="false"
        aria-controls="cluster-${index}"
        onclick="toggleCluster(${index})"
      >
        Show keywords
      </button>
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
  const header = document.querySelector(`.cluster-header[data-cluster-index="${index}"]`);
  const toggleButton = document.querySelector(`.cluster-toggle[data-cluster-index="${index}"]`);
  if (content) {
    const willShow = content.style.display === 'none';
    content.style.display = willShow ? 'block' : 'none';
    if (header) {
      header.setAttribute('aria-expanded', String(willShow));
    }
    if (toggleButton) {
      toggleButton.setAttribute('aria-expanded', String(willShow));
      toggleButton.classList.toggle('is-open', willShow);
      toggleButton.textContent = willShow ? 'Hide keywords' : 'Show keywords';
    }
  }
}

function toggleCrawledUrls() {
  if (!elements.contentUrls) {
    return;
  }

  const isCollapsed = elements.contentUrls.classList.toggle('is-collapsed');
  elements.contentUrls.hidden = isCollapsed;

  if (elements.crawledUrlsToggle) {
    elements.crawledUrlsToggle.setAttribute('aria-expanded', String(!isCollapsed));
    elements.crawledUrlsToggle.classList.toggle('is-open', !isCollapsed);
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

function renderMessage(className, message) {
  if (!elements.messageContainer) return;

  elements.messageContainer.innerHTML = '';
  const container = document.createElement('div');
  container.className = className;
  container.textContent = message;
  elements.messageContainer.appendChild(container);
}

function showSuccess(message) {
  renderMessage('success', message);
}

function showError(message) {
  renderMessage('error', message);
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

  if (elements.connectGoogleBtn) {
    elements.connectGoogleBtn.disabled = true;
    elements.connectGoogleBtn.addEventListener('click', () => {
      window.location.href = '/api/auth/google';
    });
  }

  if (elements.refreshStatusBtn) {
    elements.refreshStatusBtn.addEventListener('click', () => {
      loadIntegrationStatus(true);
    });
  }

  if (elements.refreshStatusSummaryBtn) {
    elements.refreshStatusSummaryBtn.addEventListener('click', () => {
      loadIntegrationStatus(true);
    });
  }

  if (elements.showIntegrationSettingsBtn) {
    elements.showIntegrationSettingsBtn.addEventListener('click', () => {
      setIntegrationSettingsVisibility(true);
    });
  }

  if (elements.hideIntegrationSettingsBtn) {
    elements.hideIntegrationSettingsBtn.addEventListener('click', () => {
      setIntegrationSettingsVisibility(false);
    });
  }

  if (elements.toggleCrawlSettingsBtn) {
    elements.toggleCrawlSettingsBtn.addEventListener('click', toggleCrawlSettings);
  }

  if (elements.crawledUrlsToggle) {
    elements.crawledUrlsToggle.addEventListener('click', toggleCrawledUrls);
  }

  setCrawlSettingsVisibility(state.showCrawlSettings);

  updateProgress(0, 'Ready');
  handleRedirectMessages();
  initializeIntegrations();
});

window.toggleCluster = toggleCluster;
window.toggleCrawledUrls = toggleCrawledUrls;
