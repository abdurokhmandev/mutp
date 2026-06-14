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
    if (token) {
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
    }
  },

  async logout() {
    await Auth.logout();
  },
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.updateNavAuth();
});
