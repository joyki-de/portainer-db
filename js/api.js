const PortainerAPI = {
  baseUrl: '',
  token: '',
  endpointId: 1,
  proxyMode: false,

  async request(path, options = {}) {
    const url = this.proxyMode ? path : `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      if (this.token.length > 50) {
        headers['X-API-Key'] = this.token;
      } else {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
    }

    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error(
          'CORS-Fehler: Der Browser blockiert diese Anfrage. ' +
          'Lösung: Portainer mit --trusted-origins starten oder nginx Reverse Proxy nutzen. ' +
          'Siehe README.md Abschnitt "CORS konfigurieren".'
        );
      }
      throw err;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`API ${response.status}: ${response.statusText} ${text}`.trim());
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  },

  async login(username, password) {
    const data = await this.request('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ Username: username, Password: password })
    });
    this.token = data.jwt;
    return data.jwt;
  },

  init(config) {
    this.endpointId = config.endpointId || 1;

    if (config.authMode === 'apikey') {
      this.token = config.apiKey;
    }

    if (config.url && config.url.length > 0) {
      this.baseUrl = config.url.replace(/\/+$/, '');
      this.proxyMode = false;
    } else {
      this.baseUrl = '';
      this.proxyMode = true;
    }
  },

  async getStatus() {
    return this.request('/api/system/status');
  },

  async getVersion() {
    return this.request('/api/system/version');
  },

  async getSystemInfo() {
    return this.request(`/api/endpoints/${this.endpointId}/docker/info`);
  },

  async getDashboard() {
    return this.request(`/api/docker/${this.endpointId}/dashboard`);
  },

  async getContainers(all = true) {
    return this.request(
      `/api/endpoints/${this.endpointId}/docker/containers/json?all=${all}`
    );
  },

  async getContainerStats(containerId) {
    return this.request(
      `/api/endpoints/${this.endpointId}/docker/containers/${containerId}/stats?stream=false`
    );
  },

  async getStacks() {
    return this.request('/api/stacks');
  },

  async getEndpoints() {
    return this.request('/api/endpoints?excludeSnapshots=false');
  },

  async testConnection() {
    try {
      const status = await this.getStatus();
      const version = await this.getVersion().catch(() => null);
      return {
        success: true,
        version: version?.ServerVersion || 'unknown',
        edition: version?.ServerEdition || 'unknown',
        updateAvailable: version?.UpdateAvailable || false,
        latestVersion: version?.LatestVersion || null
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
