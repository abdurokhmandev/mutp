// API sozlamalari — frontend va backend ulanishi
(function () {
  const host = window.location.hostname;
  const port = window.location.port;

  // Local development uchun
  if (host === 'localhost' || host === '127.0.0.1') {
    if (port === '8000') {
      window.APP_CONFIG = { API_BASE_URL: '/api/v1' };
    } else {
      window.APP_CONFIG = { API_BASE_URL: 'http://127.0.0.1:8000/api/v1' };
    }
    return;
  }

  // Production (Railway API)
  window.APP_CONFIG = {
    API_BASE_URL: window.location.origin + '/api/v1',
  };
})();
