const ContainerDetailView = {
  container: null,
  containerId: null,
  containerInfo: null,
  charts: {},
  pollInterval: null,
  pollRate: 2000,
  prevStats: null,
  maxPoints: 120,
  netPrev: null,

  init() {
    this.container = document.getElementById('view-container-detail');
  },

  async render(containerId) {
    if (!this.container) return;
    this.containerId = containerId;
    this.stopPolling();
    this.charts = {};
    this.prevStats = null;
    this.netPrev = null;

    this.container.innerHTML = '<div class="loading-spinner">Lade Container-Details...</div>';

    try {
      this.containerInfo = await PortainerAPI.request(
        `/api/endpoints/${PortainerAPI.endpointId}/docker/containers/${containerId}/json`
      );
      this.renderShell();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await this.fetchAndUpdate();
      this.startPolling();
    } catch (err) {
      this.container.innerHTML = `<div class="empty-state"><p>Fehler beim Laden des Containers</p><p style="font-size:0.8rem">${err.message}</p></div>`;
    }
  },

  renderShell() {
    const info = this.containerInfo;
    const name = (info.Name || '').replace(/^\//, '');
    const image = info.Config?.Image || '-';
    const state = info.State?.Status || '-';
    const started = info.State?.StartedAt
      ? new Date(info.State.StartedAt).toLocaleString('de-DE')
      : '-';

    const rates = [2, 5, 10, 30, 60, 300];
    const rateOptions = rates.map(r =>
      `<option value="${r}" ${r === this.pollRate / 1000 ? 'selected' : ''}>${r < 60 ? r + ' sek' : (r / 60) + ' min}</option>`
    ).join('');

    this.container.innerHTML = `
      <div class="detail-header">
        <a href="#/containers" class="back-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Zurück
        </a>
        <div class="detail-refresh">
          <label style="font-size:0.8rem;color:var(--text-secondary);margin-right:0.3rem">Refresh:</label>
          <select id="detailRefreshRate" class="select-sm">${rateOptions}</select>
        </div>
      </div>
      <div class="section-header">
        <h2 class="section-title">${this.escapeHtml(name)}</h2>
      </div>
      <div class="detail-info">
        <div class="detail-info-item">
          <span class="detail-info-label">Image:</span>
          <span class="detail-info-value" style="font-family:monospace">${this.escapeHtml(image)}</span>
        </div>
        <div class="detail-info-item">
          <span class="detail-info-label">Status:</span>
          <span class="status-badge status-dot ${state === 'running' ? 'running' : 'stopped'}">${this.escapeHtml(state)}</span>
        </div>
        <div class="detail-info-item">
          <span class="detail-info-label">Gestartet:</span>
          <span class="detail-info-value">${started}</span>
        </div>
        <div class="detail-info-item" id="detailCurrentStats"></div>
      </div>
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card-header">
            <span class="chart-title">CPU Auslastung</span>
            <span class="chart-current" id="cpuCurrent">-</span>
          </div>
          <div class="chart-wrapper" id="cpuChart"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <span class="chart-title">Memory Auslastung</span>
            <span class="chart-current" id="memCurrent">-</span>
          </div>
          <div class="chart-wrapper" id="memChart"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <span class="chart-title">Network I/O</span>
            <span class="chart-current" id="netCurrent">-</span>
          </div>
          <div class="chart-wrapper" id="netChart"></div>
        </div>
      </div>`;

    document.getElementById('detailRefreshRate').addEventListener('change', (e) => {
      this.pollRate = parseInt(e.target.value) * 1000;
      this.startPolling();
    });
  },

  async fetchAndUpdate() {
    try {
      const stats = await PortainerAPI.getContainerStats(this.containerId);
      this.processStats(stats);
    } catch (err) {
      console.warn('Stats fetch error:', err);
    }
  },

  processStats(stats) {
    const now = Date.now() / 1000;

    const cpuPercent = this.calcCpuPercent(stats);
    const memPercent = stats.memory_stats?.limit
      ? (stats.memory_stats.usage / stats.memory_stats.limit) * 100
      : 0;
    const memMB = (stats.memory_stats?.usage || 0) / 1048576;
    const memLimit = stats.memory_stats?.limit
      ? (stats.memory_stats.limit / 1073741824).toFixed(1) + ' GB'
      : '-';

    const net = this.calcNetworkSpeed(stats);

    const cpuVal = Math.min(Math.max(cpuPercent, 0), 100);
    const memVal = Math.min(Math.max(memPercent, 0), 100);

    this.cpuData.push([now, cpuVal]);
    this.memData.push([now, memVal]);
    this.netData.push([now, net.rx, net.tx]);

    if (this.cpuData.length > this.maxPoints) this.cpuData.shift();
    if (this.memData.length > this.maxPoints) this.memData.shift();
    if (this.netData.length > this.maxPoints) this.netData.shift();

    this.updateLabel('cpuCurrent', `${cpuVal.toFixed(1)}%`);
    this.updateLabel('memCurrent', `${memVal.toFixed(1)}% (${memMB.toFixed(0)} MB / ${memLimit})`);
    this.updateLabel('netCurrent', `RX: ${this.formatSpeed(net.rx)} · TX: ${this.formatSpeed(net.tx)}`);
    this.updateLabel('detailCurrentStats',
      `CPU: ${cpuVal.toFixed(1)}% | Mem: ${memVal.toFixed(1)}% (${memMB.toFixed(0)} MB)`
    );

    this.updateCharts();
    this.prevStats = stats;
  },

  get cpuData() {
    if (!this._cpuData) this._cpuData = [];
    return this._cpuData;
  },
  get memData() {
    if (!this._memData) this._memData = [];
    return this._memData;
  },
  get netData() {
    if (!this._netData) this._netData = [];
    return this._netData;
  },

  calcCpuPercent(stats) {
    if (!this.prevStats) return 0;
    const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage || 0)
      - (this.prevStats.cpu_stats?.cpu_usage?.total_usage || 0);
    const sysDelta = (stats.cpu_stats?.system_cpu_usage || 0)
      - (this.prevStats.cpu_stats?.system_cpu_usage || 0);
    const cpus = stats.cpu_stats?.online_cpus || 1;
    if (sysDelta <= 0) return 0;
    return (cpuDelta / sysDelta) * cpus * 100;
  },

  calcNetworkSpeed(stats) {
    if (!this.prevStats) return { rx: 0, tx: 0 };
    let rx = 0, tx = 0;
    const ifaces = Object.keys(stats.networks || {});
    for (const iface of ifaces) {
      const curr = stats.networks[iface];
      const prev = this.prevStats.networks?.[iface];
      if (curr && prev) {
        rx += Math.max(0, curr.rx_bytes - prev.rx_bytes);
        tx += Math.max(0, curr.tx_bytes - prev.tx_bytes);
      }
    }
    const interval = this.pollRate / 1000;
    return {
      rx: rx / interval / 1048576,
      tx: tx / interval / 1048576
    };
  },

  updateCharts() {
    if (this.cpuData.length < 2) return;

    const cpuD = this.cpuData.map(p => p[0]);
    const cpuV = this.cpuData.map(p => p[1]);
    const memD = this.memData.map(p => p[0]);
    const memV = this.memData.map(p => p[1]);
    const netD = this.netData.map(p => p[0]);
    const netRx = this.netData.map(p => p[1]);
    const netTx = this.netData.map(p => p[2]);

    this.updateCpuChart([cpuD, cpuV]);
    this.updateMemChart([memD, memV]);
    this.updateNetChart([netD, netRx, netTx]);
  },

  makeTimeAxis() {
    const { textColor, gridColor } = this.getThemeColors();
    return {
      stroke: textColor,
      grid: { stroke: gridColor },
      ticks: { stroke: textColor },
      values: (u, vals) => vals.map(v => {
        const d = new Date(v * 1000);
        return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }),
      size: [0, 30]
    };
  },

  makeValueAxis(yScale, yFormat) {
    const { textColor, gridColor } = this.getThemeColors();
    return {
      scale: yScale,
      stroke: textColor,
      grid: { stroke: gridColor },
      ticks: { stroke: textColor },
      values: (u, vals) => vals.map(v => yFormat(v)),
      size: [55, 0]
    };
  },

  getChartWidth() {
    const el = document.getElementById('cpuChart');
    if (el && el.offsetWidth > 10) return el.offsetWidth;
    const main = document.querySelector('.main-content');
    return main ? Math.max(main.offsetWidth - 60, 300) : 600;
  },

  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      textColor: isDark ? '#94a3b8' : '#666',
      gridColor: isDark ? '#334155' : '#f0f0f0'
    };
  },

  updateCpuChart(data) {
    const el = document.getElementById('cpuChart');
    if (!el) return;

    if (this.charts.cpu) {
      this.charts.cpu.setData(data);
      return;
    }

    this.charts.cpu = new uPlot({
      width: this.getChartWidth(),
      height: 180,
      padding: [8, 8, 8, 8],
      scales: {
        x: {},
        y: { range: [0, 100] }
      },
      axes: [
        this.makeTimeAxis(),
        this.makeValueAxis('y', v => v.toFixed(0) + '%')
      ],
      series: [
        {},
        {
          label: 'CPU',
          stroke: '#ff6384',
          fill: '#ff638418',
          scale: 'y',
          width: 2
        }
      ],
      cursor: { drag: { setScale: false } }
    }, data, el);
  },

  updateMemChart(data) {
    const el = document.getElementById('memChart');
    if (!el) return;

    if (this.charts.mem) {
      this.charts.mem.setData(data);
      return;
    }

    this.charts.mem = new uPlot({
      width: this.getChartWidth(),
      height: 180,
      padding: [8, 8, 8, 8],
      scales: {
        x: {},
        y: { range: [0, 100] }
      },
      axes: [
        this.makeTimeAxis(),
        this.makeValueAxis('y', v => v.toFixed(0) + '%')
      ],
      series: [
        {},
        {
          label: 'Memory',
          stroke: '#36a2eb',
          fill: '#36a2eb18',
          scale: 'y',
          width: 2
        }
      ],
      cursor: { drag: { setScale: false } }
    }, data, el);
  },

  updateNetChart(data) {
    const el = document.getElementById('netChart');
    if (!el) return;

    if (this.charts.net) {
      this.charts.net.setData(data);
      return;
    }

    const { textColor, gridColor } = this.getThemeColors();

    this.charts.net = new uPlot({
      width: this.getChartWidth(),
      height: 180,
      padding: [8, 8, 8, 8],
      scales: {
        x: {},
        y: { range: [0, 'auto'] }
      },
      axes: [
        this.makeTimeAxis(),
        {
          scale: 'y',
          stroke: textColor,
          grid: { stroke: gridColor },
          ticks: { stroke: textColor },
          values: (u, vals) => vals.map(v => v.toFixed(1) + ' MB/s'),
          size: [70, 0]
        }
      ],
      series: [
        {},
        {
          label: 'RX',
          stroke: '#4bc0c0',
          fill: '#4bc0c018',
          scale: 'y',
          width: 2
        },
        {
          label: 'TX',
          stroke: '#ff9f40',
          fill: '#ff9f4018',
          scale: 'y',
          width: 2,
          dash: [6, 3]
        }
      ],
      cursor: { drag: { setScale: false } }
    }, data, el);
  },

  formatSpeed(mbps) {
    if (mbps < 0.01) return '0 MB/s';
    if (mbps < 1) return (mbps * 1024).toFixed(0) + ' KB/s';
    return mbps.toFixed(2) + ' MB/s';
  },

  updateLabel(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  startPolling() {
    this.stopPolling();
    this.pollInterval = setInterval(() => this.fetchAndUpdate(), this.pollRate);
  },

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  },

  destroy() {
    this.stopPolling();
    if (this.charts.cpu) { this.charts.cpu.destroy(); this.charts.cpu = null; }
    if (this.charts.mem) { this.charts.mem.destroy(); this.charts.mem = null; }
    if (this.charts.net) { this.charts.net.destroy(); this.charts.net = null; }
    this._cpuData = [];
    this._memData = [];
    this._netData = [];
    this.prevStats = null;
    this.netPrev = null;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
