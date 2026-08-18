const ContainerDetailView = {
  container: null,
  containerId: null,
  containerInfo: null,
  charts: {},
  data: {},
  pollInterval: null,
  prevStats: null,
  maxPoints: 300,

  init() {
    this.container = document.getElementById('view-container-detail');
  },

  async render(containerId) {
    if (!this.container) return;
    this.containerId = containerId;
    this.stopPolling();
    this.charts = {};
    this.data = {};
    this.prevStats = null;

    this.container.innerHTML = '<div class="loading-spinner">Lade Container-Details...</div>';

    try {
      this.containerInfo = await PortainerAPI.request(
        `/api/endpoints/${PortainerAPI.endpointId}/docker/containers/${containerId}/json`
      );
      this.renderShell();
      await new Promise(r => setTimeout(r, 50));
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

    this.container.innerHTML = `
      <div class="detail-header">
        <a href="#/containers" class="back-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Zurück
        </a>
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

    this.pushData('cpu', now, cpuVal);
    this.pushData('mem', now, memVal);
    this.pushData('netRx', now, net.rx);
    this.pushData('netTx', now, net.tx);

    this.updateLabel('cpuCurrent', `${cpuVal.toFixed(1)}%`);
    this.updateLabel('memCurrent', `${memVal.toFixed(1)}% (${memMB.toFixed(0)} MB / ${memLimit})`);
    this.updateLabel('netCurrent', `RX: ${this.formatSpeed(net.rx)} · TX: ${this.formatSpeed(net.tx)}`);
    this.updateLabel('detailCurrentStats',
      `CPU: ${cpuVal.toFixed(1)}% | Mem: ${memVal.toFixed(1)}% (${memMB.toFixed(0)} MB)`
    );

    this.renderCharts();
    this.prevStats = stats;
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
    let rx = 0, tx = 0;
    if (!this.prevStats) return { rx: 0, tx: 0 };
    const ifaces = Object.keys(stats.networks || {});
    for (const iface of ifaces) {
      const curr = stats.networks[iface];
      const prev = this.prevStats.networks?.[iface];
      if (curr && prev) {
        rx += (curr.rx_bytes - prev.rx_bytes);
        tx += (curr.tx_bytes - prev.tx_bytes);
      }
    }
    const interval = 2;
    return {
      rx: Math.max(rx / interval / 1048576, 0),
      tx: Math.max(tx / interval / 1048576, 0)
    };
  },

  pushData(key, timestamp, value) {
    if (!this.data[key]) this.data[key] = [];
    this.data[key].push({ t: timestamp, v: value });
    if (this.data[key].length > this.maxPoints) {
      this.data[key].shift();
    }
  },

  renderCharts() {
    const cpuPoints = this.data.cpu?.length || 0;
    const memPoints = this.data.mem?.length || 0;
    const netPoints = Math.max(this.data.netRx?.length || 0, this.data.netTx?.length || 0);

    if (cpuPoints >= 2) this.renderCpuChart();
    if (memPoints >= 2) this.renderMemChart();
    if (netPoints >= 2) this.renderNetChart();
  },

  getChartWidth() {
    const el = document.getElementById('cpuChart') || document.querySelector('.chart-wrapper');
    if (el && el.offsetWidth > 0) return el.offsetWidth;
    const main = document.querySelector('.main-content');
    return main ? main.offsetWidth - 40 : 600;
  },

  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      textColor: isDark ? '#94a3b8' : '#666',
      gridColor: isDark ? '#334155' : '#f0f0f0',
      bg: isDark ? '#1e293b' : '#ffffff'
    };
  },

  makeAxes(yFormat, yScale) {
    const { textColor, gridColor } = this.getThemeColors();
    return [
      {
        stroke: textColor,
        grid: { stroke: gridColor },
        ticks: { stroke: textColor },
        values: (u, vals) => vals.map(v => {
          const d = new Date(v * 1000);
          return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }),
        size: [0, 30]
      },
      {
        scale: yScale,
        stroke: textColor,
        grid: { stroke: gridColor },
        ticks: { stroke: textColor },
        values: (u, vals) => vals.map(v => yFormat(v)),
        size: [55, 0]
      }
    ];
  },

  renderCpuChart() {
    const el = document.getElementById('cpuChart');
    if (!el) return;

    const timestamps = this.data.cpu.map(p => p.t);
    const values = this.data.cpu.map(p => p.v);
    const seriesData = [timestamps, values];

    if (this.charts.cpu) {
      this.charts.cpu.setData(seriesData);
      return;
    }

    this.charts.cpu = new uPlot({
      width: this.getChartWidth(),
      height: 180,
      padding: [8, 8, 8, 8],
      scales: {
        x: { range: [timestamps[0], timestamps[timestamps.length - 1]] },
        cpu: { range: [0, 100] }
      },
      axes: this.makeAxes(v => v.toFixed(0) + '%', 'cpu'),
      series: [
        { stroke: 'transparent' },
        {
          label: 'CPU',
          stroke: '#ff6384',
          fill: '#ff638420',
          scale: 'cpu',
          width: 2
        }
      ],
      cursor: { drag: { setScale: false } }
    }, seriesData, el);
  },

  renderMemChart() {
    const el = document.getElementById('memChart');
    if (!el) return;

    const timestamps = this.data.mem.map(p => p.t);
    const values = this.data.mem.map(p => p.v);
    const seriesData = [timestamps, values];

    if (this.charts.mem) {
      this.charts.mem.setData(seriesData);
      return;
    }

    this.charts.mem = new uPlot({
      width: this.getChartWidth(),
      height: 180,
      padding: [8, 8, 8, 8],
      scales: {
        x: { range: [timestamps[0], timestamps[timestamps.length - 1]] },
        mem: { range: [0, 100] }
      },
      axes: this.makeAxes(v => v.toFixed(0) + '%', 'mem'),
      series: [
        { stroke: 'transparent' },
        {
          label: 'Memory',
          stroke: '#36a2eb',
          fill: '#36a2eb20',
          scale: 'mem',
          width: 2
        }
      ],
      cursor: { drag: { setScale: false } }
    }, seriesData, el);
  },

  renderNetChart() {
    const el = document.getElementById('netChart');
    if (!el) return;

    const rx = this.data.netRx || [];
    const tx = this.data.netTx || [];
    const len = Math.max(rx.length, tx.length);
    const timestamps = [];
    const rxVals = [];
    const txVals = [];

    for (let i = 0; i < len; i++) {
      timestamps.push(rx[i]?.t || tx[i]?.t || 0);
      rxVals.push(rx[i]?.v || 0);
      txVals.push(tx[i]?.v || 0);
    }

    const seriesData = [timestamps, rxVals, txVals];
    const { textColor, gridColor } = this.getThemeColors();

    if (this.charts.net) {
      this.charts.net.setData(seriesData);
      return;
    }

    this.charts.net = new uPlot({
      width: this.getChartWidth(),
      height: 180,
      padding: [8, 8, 8, 8],
      scales: {
        x: { range: [timestamps[0], timestamps[timestamps.length - 1]] },
        net: { range: [0, 'auto'] }
      },
      axes: [
        {
          stroke: textColor,
          grid: { stroke: gridColor },
          ticks: { stroke: textColor },
          values: (u, vals) => vals.map(v => {
            const d = new Date(v * 1000);
            return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          }),
          size: [0, 30]
        },
        {
          scale: 'net',
          stroke: textColor,
          grid: { stroke: gridColor },
          ticks: { stroke: textColor },
          values: (u, vals) => vals.map(v => v.toFixed(1) + ' MB/s'),
          size: [70, 0]
        }
      ],
      series: [
        { stroke: 'transparent' },
        {
          label: 'RX',
          stroke: '#4bc0c0',
          fill: '#4bc0c020',
          scale: 'net',
          width: 2
        },
        {
          label: 'TX',
          stroke: '#ff9f40',
          fill: '#ff9f4020',
          scale: 'net',
          width: 2,
          dash: [6, 3]
        }
      ],
      cursor: { drag: { setScale: false } }
    }, seriesData, el);
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
    this.pollInterval = setInterval(() => this.fetchAndUpdate(), 2000);
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
    this.data = {};
    this.prevStats = null;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
