// app.js — umumiy yordamchi funksiyalar
const App = {
  getUser() {
    const raw = localStorage.getItem('user_data');
    return raw ? JSON.parse(raw) : null;
  },

  isLoggedIn() {
    return !!API.getAccessToken();
  },

  dashboardUrl(role) {
    return role === 'teacher' ? '/dashboard-teacher.html' : '/dashboard-student.html';
  },

  requireAuth(roles = null, redirectTo = '/auth.html') {
    if (!this.isLoggedIn()) {
      window.location.href = redirectTo;
      return false;
    }
    if (roles) {
      const role = localStorage.getItem('user_role');
      if (!roles.includes(role)) {
        window.location.href = this.dashboardUrl(role);
        return false;
      }
    }
    return true;
  },

  handle403(data, endpoint) {
    const role = localStorage.getItem('user_role');
    const msg = data?.message || data?.detail || '';

    if (endpoint?.includes('/student/') && role === 'teacher') {
      window.location.href = '/dashboard-teacher.html';
      return;
    }
    if (endpoint?.includes('/teacher/') && role === 'student') {
      window.location.href = '/dashboard-student.html';
      return;
    }
    if (msg.includes('tasdiqlanmagan')) {
      window.toast?.show("O'qituvchi akkauntingiz hali tasdiqlanmagan. Admin bilan bog'laning.", 'error');
    }
  },

  initials(name) {
    if (!name) return '?';
    return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  },

  formatPrice(course) {
    if (course.is_free || Number(course.effective_price || course.price) === 0) {
      return { text: 'Bepul', className: 'free' };
    }
    const price = Number(course.effective_price || course.price);
    return { text: `${price.toLocaleString('uz-UZ')} so'm`, className: '' };
  },

  formatDuration(seconds) {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}s ${m}d`;
    return `${m} daqiqa`;
  },

  formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('uz-UZ');
  },

  levelLabel(level) {
    const map = { beginner: "Boshlang'ich", intermediate: "O'rta", advanced: 'Yuqori' };
    return map[level] || level;
  },

  languageLabel(lang) {
    const map = { uz: "O'zbekcha", ru: 'Ruscha', en: 'Inglizcha' };
    return map[lang] || lang;
  },

  markdown(text) {
    if (typeof marked !== 'undefined' && marked.parse) {
      try {
        return marked.parse(text);
      } catch (e) {
        console.error("Marked parsing error:", e);
      }
    }
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  },

  async copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn("navigator.clipboard failed, falling back", err);
      }
    }
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      const success = document.execCommand('copy');
      document.body.removeChild(el);
      if (!success) throw new Error("copy command failed");
      return true;
    } catch (err) {
      console.error("Clipboard copy failed completely", err);
      return false;
    }
  },

  updateNav() {
    const user = this.getUser();
    const nameEl = document.querySelector('[data-user-name]');
    const avatarEl = document.querySelector('[data-user-avatar]');
    const logoutBtn = document.querySelector('[data-logout]');

    if (user && nameEl) {
      nameEl.textContent = `Salom, ${user.first_name || user.full_name} 👋`;
    }
    if (user && avatarEl) {
      avatarEl.textContent = this.initials(user.full_name);
    }
    if (logoutBtn) {
      logoutBtn.onclick = (e) => {
        e.preventDefault();
        Auth.logout();
      };
    }
  },

  updateNavAuth() {
    const navAuth = document.getElementById('nav-auth');
    if (!navAuth) return;
    const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    const hasToken = token && token !== 'undefined' && token !== 'null';

    if (hasToken) {
      const user = JSON.parse(localStorage.getItem('user_data') || '{}');
      const role = localStorage.getItem('user_role');
      const dashUrl = role === 'teacher' ? '/dashboard-teacher.html' : '/dashboard-student.html';
      
      navAuth.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <a href="${dashUrl}" class="btn-primary" style="padding: 8px 16px; font-size: 14px; text-decoration: none; display: flex; align-items: center; gap: 6px; border-radius: 12px; font-weight: 700;">
            <i class="ti ti-layout-dashboard" style="font-size:16px;"></i> Kabinet
          </a>
          <div class="user-dropdown-container" style="position: relative;">
            <div class="user-avatar-btn" onclick="toggleUserDropdown()" style="width: 40px; height: 40px; border-radius: 50%; background: var(--duo-green-bg); color: var(--duo-green); border: 2px solid var(--duo-green); display: flex; align-items: center; justify-content: center; font-weight: bold; cursor: pointer; font-size: 15px; user-select: none;">
              ${this.initials(user.full_name)}
            </div>
            <div id="userDropdown" class="user-dropdown-menu" style="display: none; position: absolute; right: 0; top: 48px; background: var(--white); border: 2px solid var(--border-2); border-radius: 16px; min-width: 180px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); padding: 8px 0; z-index: 1000;">
              <div style="padding: 8px 16px; border-bottom: 2px solid var(--border-2); font-weight: bold; font-size: 14px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.full_name || user.email}</div>
              <a href="${dashUrl}" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; color: var(--ink); text-decoration: none; font-size: 13px; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background='none'"><i class="ti ti-layout-dashboard"></i> Kabinet</a>
              <a href="/profile.html" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; color: var(--ink); text-decoration: none; font-size: 13px; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background='none'"><i class="ti ti-user"></i> Profilim</a>
              <a href="/profile.html#settings" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; color: var(--ink); text-decoration: none; font-size: 13px; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background='none'"><i class="ti ti-settings"></i> Sozlamalar</a>
              <div style="height: 2px; background: var(--border-2); margin: 4px 0;"></div>
              <a href="#" onclick="event.preventDefault(); Auth.logout();" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; color: var(--error); text-decoration: none; font-size: 13px; font-weight: 700; transition: background 0.2s;" onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background='none'"><i class="ti ti-logout"></i> Chiqish</a>
            </div>
          </div>
        </div>
      `;

      window.toggleUserDropdown = function() {
        const menu = document.getElementById('userDropdown');
        if (menu) {
          menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
      };

      document.addEventListener('click', (e) => {
        const container = document.querySelector('.user-dropdown-container');
        const menu = document.getElementById('userDropdown');
        if (menu && container && !container.contains(e.target)) {
          menu.style.display = 'none';
        }
      });
    } else {
      navAuth.innerHTML = `
        <a href="/auth.html?tab=login" class="btn-secondary">Kirish</a>
        <a href="/auth.html?role=student&tab=register" class="btn-primary">Bepul boshlash</a>
      `;
    }
  },

  async logout() {
    await Auth.logout();
  },

  showHomeworkModal(homeworkId, title, callback) {
    const existing = document.getElementById('hwSubmitModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'hwSubmitModal';
    modal.style = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center; z-index: 10000;
      font-family: 'Plus Jakarta Sans', sans-serif; opacity: 0; transition: opacity 0.2s ease;
    `;

    modal.innerHTML = `
      <div style="background: white; border-radius: 24px; width: 90%; max-width: 480px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); transform: scale(0.95); transition: transform 0.2s ease;">
        <h3 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 800; color: var(--ink);">Vazifani topshirish</h3>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: var(--muted);">${title}</p>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 6px;">Yozma javob (ixtiyoriy):</label>
          <textarea id="hwTextAnswer" placeholder="Vazifa javobini shu yerga yozishingiz mumkin..." rows="4" style="width: 100%; padding: 12px; border: 2px solid var(--border); border-radius: 12px; font-size: 13.5px; font-family: inherit; outline: none; resize: vertical; box-sizing: border-box;"></textarea>
        </div>

        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 6px;">Fayl yuklash (ixtiyoriy):</label>
          <div style="border: 2px dashed var(--border); border-radius: 12px; padding: 16px; text-align: center; cursor: pointer; position: relative;" id="hwFileDropzone">
            <input type="file" id="hwFileAnswer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;">
            <div id="hwFileInfo" style="color: var(--muted); font-size: 13px;">
              <i class="ti ti-cloud-upload" style="font-size: 24px; color: var(--duo-green); display: block; margin-bottom: 6px;"></i>
              Faylni sudrab keling yoki bosing
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px;">
          <button id="hwCancelBtn" style="padding: 10px 20px; border: none; border-radius: 12px; background: var(--surface); color: var(--ink-2); font-weight: 700; font-size: 13.5px; cursor: pointer;">Bekor qilish</button>
          <button id="hwSubmitBtn" style="padding: 10px 24px; border: none; border-radius: 12px; background: var(--duo-green); color: white; font-weight: 700; font-size: 13.5px; cursor: pointer; box-shadow: 0 4px 0 var(--duo-green-dark); transition: transform 0.1s;">Yuborish</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    setTimeout(() => {
      modal.style.opacity = '1';
      modal.firstElementChild.style.transform = 'scale(1)';
    }, 10);

    const fileInput = modal.querySelector('#hwFileAnswer');
    const fileInfo = modal.querySelector('#hwFileInfo');

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        const name = fileInput.files[0].name;
        const size = (fileInput.files[0].size / 1024 / 1024).toFixed(2);
        fileInfo.innerHTML = `<i class="ti ti-file" style="font-size: 24px; color: var(--duo-green); display: block; margin-bottom: 6px;"></i> <strong>${name}</strong> (${size} MB)`;
      }
    });

    const closeModal = () => {
      modal.style.opacity = '0';
      modal.firstElementChild.style.transform = 'scale(0.95)';
      setTimeout(() => modal.remove(), 200);
    };

    modal.querySelector('#hwCancelBtn').addEventListener('click', closeModal);
    modal.querySelector('#hwSubmitBtn').addEventListener('click', async () => {
      const text = modal.querySelector('#hwTextAnswer').value.trim();
      const file = fileInput.files[0];

      const btn = modal.querySelector('#hwSubmitBtn');
      btn.disabled = true;
      btn.textContent = 'Yuborilmoqda...';

      const formData = new FormData();
      if (text) formData.append('text_answer', text);
      if (file) formData.append('file_answer', file);

      try {
        await callback(formData);
        closeModal();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Yuborish';
        window.toast?.show(e.message || 'Xatolik yuz berdi', 'error');
      }
    });
  },

  initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.renderThemeToggle(savedTheme);
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    this.updateThemeToggleIcon(newTheme);
  },

  renderThemeToggle(currentTheme) {
    const existing = document.getElementById('themeToggleBtn');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'themeToggleBtn';
    btn.style = `
      position: fixed; bottom: 24px; right: 24px; width: 48px; height: 48px;
      border-radius: 50%; background: var(--white); border: 2px solid var(--border-2);
      box-shadow: 0 8px 16px rgba(0,0,0,0.1); display: flex; align-items: center;
      justify-content: center; cursor: pointer; z-index: 9999;
      font-size: 20px; transition: transform 0.2s, background 0.2s;
    `;
    btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';
    btn.onclick = () => this.toggleTheme();

    const icon = document.createElement('i');
    icon.className = currentTheme === 'light' ? 'ti ti-moon' : 'ti ti-sun';
    icon.style.color = 'var(--ink)';
    btn.appendChild(icon);

    document.body.appendChild(btn);
  },

  updateThemeToggleIcon(theme) {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = theme === 'light' ? 'ti ti-moon' : 'ti ti-sun';
      }
    }
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.updateNavAuth();
  App.initTheme();
});
