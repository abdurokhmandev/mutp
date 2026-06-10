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
      z-index: 9999;
    `;
    document.body.appendChild(this.container);
  }

  show(message, type = 'info') {
    const toast = document.createElement('div');
    
    // Determine colors
    let bgColor, icon;
    if (type === 'success') {
      bgColor = 'var(--green)'; icon = '✓';
    } else if (type === 'error') {
      bgColor = 'var(--rose)'; icon = '✕';
    } else {
      bgColor = 'var(--blue)'; icon = 'i';
    }

    toast.style.cssText = `
      background: ${bgColor};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 10px;
      transform: translateY(20px);
      opacity: 0;
      transition: all 0.3s ease;
    `;

    toast.innerHTML = `
      <div style="width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
        ${icon}
      </div>
      <div>${message}</div>
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
