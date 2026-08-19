const DashboardView = {
  container: null,

  init() {
    this.container = document.getElementById('view-dashboard');
  },

  async render() {
    if (!this.container) return;
    this.container.innerHTML = '<div class="loading-spinner">Lade Dashboard...</div>';

    const errors = [];

    const [status, version, systemInfo, dashboard, stacks] = await Promise.all([
      PortainerAPI.getStatus().catch(e => { errors.push('Status: ' + e.message); return null; }),
      PortainerAPI.getVersion().catch(e => { errors.push('Version: ' + e.message); return null; }),
      PortainerAPI.getSystemInfo().catch(e => { errors.push('System: ' + e.message); return null; }),
      PortainerAPI.getDashboard().catch(e => { errors.push('Dashboard: ' + e.message); return null; }),
      PortainerAPI.getStacks().catch(e => { errors.push('Stacks: ' + e.message); return []; })
    ]);

    if (errors.length > 0 && !status && !version && !dashboard) {
      this.container.innerHTML = `
        <div class="empty-state">
          <p>Fehler beim Laden des Dashboards</p>
          <p style="font-size:0.8rem;margin-bottom:1rem">Alle API-Aufrufe fehlgeschlagen. Prüfe die Einstellungen und die Portainer-Verbindung.</p>
          <p style="font-size:0.75rem;color:var(--danger)">${errors.join('<br>')}</p>
          <button class="btn btn-secondary btn-sm" style="margin-top:1rem" onclick="document.getElementById('settingsBtn').click()">Einstellungen öffnen</button>
        </div>`;
      return;
    }

    const activeStacks = Array.isArray(stacks)
      ? stacks.filter(s => s.Status === 1).length
      : 0;

    this.container.innerHTML = `
      <div class="cards-grid">
        ${this.renderStatusCard(status, version)}
        ${this.renderSystemCard(systemInfo)}
        ${this.renderRunningCard(dashboard)}
        ${this.renderStoppedCard(dashboard)}
        ${this.renderImagesCard(dashboard)}
        ${this.renderVolumesCard(dashboard)}
        ${this.renderNetworksCard(dashboard)}
        ${this.renderStacksCard(activeStacks, dashboard)}
      </div>
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">Container</h2>
          <a href="#/containers" class="btn btn-secondary btn-sm">Alle anzeigen →</a>
        </div>
        <p style="color:var(--text-muted);font-size:0.9rem">
          ${dashboard?.containers?.running || 0} laufende, ${dashboard?.containers?.stopped || 0} gestoppte Container
        </p>
      </div>
    `;
  },

  renderStatusCard(status, version) {
    const ver = version?.ServerVersion || status?.Version || '-';
    const edition = version?.ServerEdition || '-';
    const updateBadge = version?.UpdateAvailable
      ? `<span class="status-badge unhealthy">Update: ${version.LatestVersion}</span>`
      : '';

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Portainer</span>
          <div class="card-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="20" rx="2"/>
              <path d="M7 12h10M12 7v10"/>
            </svg>
          </div>
        </div>
        <div class="card-value">${ver}</div>
        <div class="card-subtitle">${edition} ${updateBadge}</div>
      </div>`;
  },

  renderSystemCard(info) {
    if (!info) return this.placeholderCard('System', 'blue');

    const cpu = info.NCPU || '?';
    const memGB = info.MemTotal
      ? (info.MemTotal / 1073741824).toFixed(1) + ' GB'
      : '?';
    const os = info.OperatingSystem || info.OS || '';
    const arch = info.Architecture || '';

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">System</span>
          <div class="card-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
              <rect x="9" y="9" width="6" height="6"/>
              <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>
            </svg>
          </div>
        </div>
        <div class="card-value">${cpu} Cores</div>
        <div class="card-subtitle">${memGB} RAM · ${arch}</div>
      </div>`;
  },

  renderRunningCard(dash) {
    const count = dash?.containers?.running ?? '-';
    return `
      <div class="card card-clickable" onclick="location.hash='#/containers'">
        <div class="card-header">
          <span class="card-title">Laufend</span>
          <div class="card-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
        </div>
        <div class="card-value">${count}</div>
        <div class="card-subtitle">Container aktiv</div>
      </div>`;
  },

  renderStoppedCard(dash) {
    const count = dash?.containers?.stopped ?? '-';
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Gestoppt</span>
          <div class="card-icon red">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
          </div>
        </div>
        <div class="card-value">${count}</div>
        <div class="card-subtitle">Container inaktiv</div>
      </div>`;
  },

  renderImagesCard(dash) {
    const count = dash?.images?.total ?? '-';
    const size = dash?.images?.size
      ? this.formatBytes(dash.images.size)
      : '';
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Images</span>
          <div class="card-icon yellow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="20" rx="2"/>
              <circle cx="8" cy="8" r="2"/>
              <path d="M22 14l-5-5L2 22"/>
            </svg>
          </div>
        </div>
        <div class="card-value">${count}</div>
        <div class="card-subtitle">${size ? size + ' belegt' : 'Docker Images'}</div>
      </div>`;
  },

  renderVolumesCard(dash) {
    const count = dash?.volumes ?? '-';
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Volumes</span>
          <div class="card-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          </div>
        </div>
        <div class="card-value">${count}</div>
        <div class="card-subtitle">Docker Volumes</div>
      </div>`;
  },

  renderNetworksCard(dash) {
    const count = dash?.networks ?? '-';
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Networks</span>
          <div class="card-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/>
            </svg>
          </div>
        </div>
        <div class="card-value">${count}</div>
        <div class="card-subtitle">Docker Networks</div>
      </div>`;
  },

  renderStacksCard(activeStacks, dash) {
    const total = dash?.stacks ?? activeStacks;
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Stacks</span>
          <div class="card-icon yellow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
        </div>
        <div class="card-value">${total}</div>
        <div class="card-subtitle">${activeStacks} aktiv</div>
      </div>`;
  },

  placeholderCard(title, color) {
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${title}</span>
          <div class="card-icon ${color}">-</div>
        </div>
        <div class="card-value">-</div>
        <div class="card-subtitle">Nicht verfügbar</div>
      </div>`;
  },

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
};
