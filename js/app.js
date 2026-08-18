const App = {
  currentView: null,
  refreshTimer: null,
  views: {},

  async init() {
    this.views = {
      dashboard: DashboardView,
      containers: ContainersView,
      'container-detail': ContainerDetailView
    };

    Object.values(this.views).forEach(v => v.init());
    this.loadTheme();
    this.bindEvents();
    this.initRouter();

    if (Config.isConfigured()) {
      this.initApi();
      this.handleRoute();
      this.startRefreshTimer();
    } else {
      this.showSettings();
    }
  },

  initApi() {
    const config = Config.load();
    if (config.authMode === 'jwt' && !PortainerAPI.token) {
      PortainerAPI.init(config);
      PortainerAPI.login(config.username, config.password).catch(() => {});
    } else {
      PortainerAPI.init(config);
    }
  },

  bindEvents() {
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
    document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
    document.getElementById('settingsClose').addEventListener('click', () => this.hideSettings());
    document.getElementById('refreshBtn').addEventListener('click', () => this.refreshCurrentView());
    document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
    document.getElementById('testConnectionBtn').addEventListener('click', () => this.testConnection());

    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') this.hideSettings();
    });

    const authRadios = document.querySelectorAll('input[name="authMode"]');
    authRadios.forEach(r => r.addEventListener('change', () => this.toggleAuthFields()));

    const refreshSlider = document.getElementById('cfgRefresh');
    refreshSlider.addEventListener('input', (e) => {
      document.getElementById('refreshLabel').textContent = e.target.value + 's';
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideSettings();
    });
  },

  initRouter() {
    window.addEventListener('hashchange', () => this.handleRoute());
    if (!location.hash) location.hash = '#/dashboard';
  },

  handleRoute() {
    const hash = location.hash || '#/dashboard';
    const parts = hash.replace('#/', '').split('/');
    const route = parts[0] || 'dashboard';
    const param = parts[1] || null;

    if (!Config.isConfigured() && route !== 'settings') {
      this.showSettings();
      return;
    }

    this.hideAllViews();
    this.updateNavActive(route);

    if (route === 'dashboard') {
      this.views.dashboard.render();
      this.currentView = 'dashboard';
    } else if (route === 'containers' && !param) {
      this.views.containers.render();
      this.currentView = 'containers';
    } else if (route === 'containers' && param) {
      this.views['container-detail'].render(param);
      this.currentView = 'container-detail';
    } else {
      this.views.dashboard.render();
      this.currentView = 'dashboard';
    }
  },

  hideAllViews() {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    if (this.currentView === 'container-detail') {
      this.views['container-detail'].destroy();
    }
  },

  updateNavActive(route) {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.route === route);
    });
  },

  showSettings() {
    const config = Config.load();
    document.getElementById('cfgApiKey').value = config.apiKey;
    document.getElementById('cfgUsername').value = config.username;
    document.getElementById('cfgPassword').value = config.password;
    document.getElementById('cfgEndpoint').value = config.endpointId;
    document.getElementById('cfgRefresh').value = config.refreshInterval;
    document.getElementById('refreshLabel').textContent = config.refreshInterval + 's';

    const authMode = config.authMode || 'apikey';
    document.querySelector(`input[name="authMode"][value="${authMode}"]`).checked = true;
    this.toggleAuthFields();

    document.getElementById('testResult').className = 'test-result';
    document.getElementById('testResult').textContent = '';
    document.getElementById('settingsModal').style.display = 'flex';
  },

  hideSettings() {
    document.getElementById('settingsModal').style.display = 'none';
  },

  toggleAuthFields() {
    const mode = document.querySelector('input[name="authMode"]:checked').value;
    const isApikey = mode === 'apikey';
    document.getElementById('apiKeyGroup').style.display = isApikey ? 'block' : 'none';
    document.getElementById('jwtGroup').style.display = isApikey ? 'none' : 'block';
    document.getElementById('jwtPassGroup').style.display = isApikey ? 'none' : 'block';
  },

  async saveSettings() {
    const mode = document.querySelector('input[name="authMode"]:checked').value;
    const config = {
      url: '',
      authMode: mode,
      apiKey: document.getElementById('cfgApiKey').value.trim(),
      username: document.getElementById('cfgUsername').value.trim(),
      password: document.getElementById('cfgPassword').value,
      endpointId: parseInt(document.getElementById('cfgEndpoint').value) || 1,
      refreshInterval: parseInt(document.getElementById('cfgRefresh').value) || 30,
      theme: Config.get('theme') || 'dark'
    };

    Config.save(config);
    this.initApi();
    this.hideSettings();
    this.startRefreshTimer();
    this.handleRoute();
    this.toast('Einstellungen gespeichert', 'success');
  },

  async testConnection() {
    const btn = document.getElementById('testConnectionBtn');
    const result = document.getElementById('testResult');
    btn.disabled = true;
    btn.textContent = 'Teste...';

    const mode = document.querySelector('input[name="authMode"]:checked').value;
    const tempConfig = {
      url: '',
      authMode: mode,
      apiKey: document.getElementById('cfgApiKey').value.trim(),
      username: document.getElementById('cfgUsername').value.trim(),
      password: document.getElementById('cfgPassword').value,
      endpointId: parseInt(document.getElementById('cfgEndpoint').value) || 1
    };

    PortainerAPI.init(tempConfig);

    if (mode === 'jwt' && tempConfig.username && tempConfig.password) {
      try {
        await PortainerAPI.login(tempConfig.username, tempConfig.password);
      } catch (e) {
        result.className = 'test-result error';
        result.textContent = 'Login fehlgeschlagen: ' + e.message;
        btn.disabled = false;
        btn.textContent = 'Verbindung testen';
        return;
      }
    }

    const res = await PortainerAPI.testConnection();
    btn.disabled = false;
    btn.textContent = 'Verbindung testen';

    if (res.success) {
      result.className = 'test-result success';
      result.textContent = `Verbunden mit Portainer v${res.version} (${res.edition})`;
      if (res.updateAvailable) {
        result.textContent += ` — Update verfügbar: v${res.latestVersion}`;
      }
    } else {
      result.className = 'test-result error';
      result.textContent = 'Fehler: ' + res.error;
    }
  },

  startRefreshTimer() {
    this.stopRefreshTimer();
    const config = Config.load();
    const interval = (config.refreshInterval || 30) * 1000;

    this.refreshTimer = setInterval(() => {
      if (this.currentView === 'dashboard' || this.currentView === 'containers') {
        this.refreshCurrentView();
      }
    }, interval);
  },

  stopRefreshTimer() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },

  refreshCurrentView() {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('spinning');
    setTimeout(() => btn.classList.remove('spinning'), 800);

    if (this.currentView === 'dashboard') {
      this.views.dashboard.render();
    } else if (this.currentView === 'containers') {
      this.views.containers.render();
    }
  },

  loadTheme() {
    const theme = Config.get('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    Config.set('theme', next);
  },

  toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
