class Toast {
  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 999999 !important;
    `;
    document.body.appendChild(this.container);
  }

  show(message, type = 'info') {
    const toast = document.createElement('div');
    
    // Determine colors
    let bgColor, icon;
    if (type === 'success') {
      bgColor = '#58CC02'; icon = '✓'; // Bright Duolingo Green
    } else if (type === 'error') {
      bgColor = '#EA2B2B'; icon = '✕'; // Bright Red
    } else {
      bgColor = '#1CB0F6'; icon = 'i'; // Bright Sky Blue
    }

    toast.style.cssText = `
      background: ${bgColor} !important;
      color: #ffffff !important;
      padding: 14px 24px;
      border-radius: 16px;
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 12px;
      transform: translateY(20px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      border: 2px solid rgba(255, 255, 255, 0.2);
    `;

    toast.innerHTML = `
      <div style="width: 22px; height: 22px; border-radius: 50%; background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; color: #ffffff !important; flex-shrink: 0;">
        ${icon}
      </div>
      <div style="color: #ffffff !important; font-weight: 600; line-height: 1.4;">${message}</div>
    `;

    this.container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });

    // Remove after 3s
    setTimeout(() => {
      toast.style.transform = 'translateY(20px)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

window.toast = new Toast();
