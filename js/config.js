const CONFIG_KEY = 'portainer_dashboard_config';

const Config = {
  defaults: {
    url: '',
    authMode: 'apikey',
    apiKey: '',
    username: '',
    password: '',
    endpointId: 1,
    refreshInterval: 30,
    theme: 'dark'
  },

  load() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return { ...this.defaults };
      return { ...this.defaults, ...JSON.parse(raw) };
    } catch {
      return { ...this.defaults };
    }
  },

  save(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  },

  get(key) {
    return this.load()[key];
  },

  set(key, value) {
    const config = this.load();
    config[key] = value;
    this.save(config);
  },

  isConfigured() {
    const c = this.load();
    return c.apiKey.length > 0 || (c.username.length > 0 && c.password.length > 0);
  }
};
