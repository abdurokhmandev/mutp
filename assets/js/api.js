// api.js - Simple fetch wrapper
const API = {
  baseUrl: '/api',
  
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Dummy CSRF Token example
    const csrfToken = localStorage.getItem('csrf_token') || 'dummy_token';
    headers['X-CSRFToken'] = csrfToken;

    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      // Since there is no actual backend, we will simulate responses
      console.log(`Mock request to: ${endpoint}`, options);
      return { success: true, message: 'Mock API request successful' };
      
      /* Actual Implementation
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
      */
    } catch (error) {
      if (window.toast) {
        window.toast.show(error.message, 'error');
      }
      console.error(error);
      throw error;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};

window.API = API;
