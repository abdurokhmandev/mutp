// API sozlamalari — frontend va backend ulanishi
(function () {
  const host = window.location.hostname;
  const port = window.location.port;

  // Django dev server (8000) orqali ochilsa — bir xil origin
  if (port === '8000' && (host === 'localhost' || host === '127.0.0.1')) {
    window.APP_CONFIG = { API_BASE_URL: '/api/v1' };
    return;
  }

  // Live Server (5500) yoki boshqa static server
  window.APP_CONFIG = {
    API_BASE_URL: `http://${host === 'localhost' || host === '127.0.0.1' ? '127.0.0.1' : host}:8000/api/v1`,
  };
})();
