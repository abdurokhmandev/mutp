// api.js — Django REST API bilan ishlash
const API = {
  get baseUrl() {
    return window.APP_CONFIG?.API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
  },

  getAccessToken() {
    return localStorage.getItem('access_token') || localStorage.getItem('auth_token');
  },

  getRefreshToken() {
    return localStorage.getItem('refresh_token');
  },

  setTokens(access, refresh) {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('auth_token', access);
  },

  clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_data');
  },

  parseError(data, status) {
    if (data.message) return data.message;

    if (data.detail) {
      if (typeof data.detail === 'string') return data.detail;
      if (Array.isArray(data.detail)) return data.detail.join(', ');
    }

    if (typeof data.errors === 'string') return data.errors;

    if (status === 403) return "Ruxsat yo'q. Hisobingiz yoki rolingiz mos kelmayapti.";
    if (status === 401) return 'Tizimga qayta kiring.';
    return `API xatosi: ${status}`;
  },

  refreshPromise: null,

  async refreshToken() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      const refresh = this.getRefreshToken();
      if (!refresh) return false;

      try {
        const response = await fetch(`${this.baseUrl}/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });
        const data = await response.json();
        if (response.ok && data.access) {
          localStorage.setItem('access_token', data.access);
          localStorage.setItem('auth_token', data.access);
          return true;
        }
      } catch (error) {
        console.error('Token yangilash xatosi:', error);
      } finally {
        this.refreshPromise = null;
      }

      this.clearTokens();
      return false;
    })();

    return this.refreshPromise;
  },

  async _parseResponse(response, endpoint = '') {
    let data = {};
    try {
      data = await response.json();
    } catch {
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('API Non-JSON Error Response:', text);
        throw Object.assign(new Error(this.parseError({}, response.status)), { status: response.status, rawResponse: text });
      }
      return {};
    }

    if (!response.ok || data.success === false) {
      if (response.status === 403 && window.App?.handle403) {
        window.App.handle403(data, endpoint);
      }
      const message = this.parseError(data, response.status);
      const error = new Error(message);
      error.errors = data.errors;
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  },

  async request(endpoint, options = {}) {
    const isFormData = options.body instanceof FormData;
    const headers = { ...options.headers };

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const token = this.getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && this.getRefreshToken() && !options._retried) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        return this.request(endpoint, { ...options, _retried: true });
      }
      window.location.href = '/auth.html';
      throw new Error('Sessiya tugadi. Qayta kiring.');
    }

    return this._parseResponse(response, endpoint);
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    if (body instanceof FormData) {
      return this.request(endpoint, { method: 'POST', body });
    }
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  patch(endpoint, body) {
    if (body instanceof FormData) {
      return this.request(endpoint, { method: 'PATCH', body });
    }
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },
};

window.API = API;
