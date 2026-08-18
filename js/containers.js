const ContainersView = {
  container: null,
  containers: [],
  sortKey: 'Names',
  sortAsc: true,

  init() {
    this.container = document.getElementById('view-containers');
  },

  async render() {
    if (!this.container) return;
    this.container.innerHTML = '<div class="loading-spinner">Lade Container...</div>';

    try {
      this.containers = await PortainerAPI.getContainers(true);
      this.containers.sort((a, b) => this.compare(a, b));
      this.renderTable();
    } catch (err) {
      this.container.innerHTML = `<div class="empty-state"><p>Fehler beim Laden der Container</p><p style="font-size:0.8rem">${err.message}</p></div>`;
    }
  },

  renderTable() {
    const sorted = [...this.containers].sort((a, b) => this.compare(a, b));

    if (sorted.length === 0) {
      this.container.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">Container</h2>
        </div>
        <div class="empty-state"><p>Keine Container gefunden</p></div>`;
      return;
    }

    const headers = [
      { key: 'Names', label: 'Name' },
      { key: 'Image', label: 'Image' },
      { key: 'State', label: 'Status' },
      { key: 'Status', label: 'Laufzeit' },
      { key: 'Created', label: 'Erstellt' }
    ];

    const rows = sorted.map(c => {
      const name = (c.Names?.[0] || '').replace(/^\//, '');
      const state = c.State || 'unknown';
      const isRunning = state === 'running';
      const statusClass = isRunning ? 'running' : 'stopped';
      const clickable = isRunning ? `class="table-row-clickable" onclick="location.hash='#/containers/${c.Id}'"` : '';

      return `
        <tr ${clickable}>
          <td><strong>${this.escapeHtml(name)}</strong></td>
          <td style="color:var(--text-secondary);font-family:monospace;font-size:0.8rem">${this.escapeHtml(c.Image || '')}</td>
          <td><span class="status-badge status-dot ${statusClass}">${this.escapeHtml(state)}</span></td>
          <td style="color:var(--text-secondary)">${this.escapeHtml(c.Status || '')}</td>
          <td style="color:var(--text-muted);font-size:0.8rem">${this.formatDate(c.Created)}</td>
        </tr>`;
    }).join('');

    this.container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">Container (${this.containers.length})</h2>
        <div class="section-actions">
          <button class="btn btn-secondary btn-sm" onclick="ContainersView.render()">Aktualisieren</button>
        </div>
      </div>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              ${headers.map(h => `
                <th class="${this.sortKey === h.key ? 'sorted' : ''}"
                    onclick="ContainersView.sort('${h.key}')">
                  ${h.label}
                  <span class="sort-arrow">${this.sortKey === h.key ? (this.sortAsc ? '▲' : '▼') : '▲'}</span>
                </th>`).join('')}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  sort(key) {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = true;
    }
    this.containers.sort((a, b) => this.compare(a, b));
    this.renderTable();
  },

  compare(a, b) {
    let va = a[this.sortKey] || '';
    let vb = b[this.sortKey] || '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return this.sortAsc ? -1 : 1;
    if (va > vb) return this.sortAsc ? 1 : -1;
    return 0;
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr * 1000);
    return d.toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
