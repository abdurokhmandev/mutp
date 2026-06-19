// dashboard-student.js — o'quvchi boshqaruv paneli va saqlangan kurslar
const StudentDashboard = {
  allHomeworks: [],

  async init() {
    if (!App.requireAuth(['student'])) return;
    App.updateNav();

    const userAvatarEl = document.querySelector('[data-user-avatar]');
    const userNameEl = document.querySelector('[data-user-name]');
    const xpDisplayEl = document.getElementById('user-xp-display');
    
    // Initial load from localStorage
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (currentUser) {
      if (userNameEl) userNameEl.textContent = currentUser.full_name || currentUser.username;
      if (xpDisplayEl) {
        xpDisplayEl.textContent = `XP: ${currentUser.xp || 0} | Daraja: ${currentUser.level || 1}`;
      }
      if (userAvatarEl) {
        if (currentUser.avatar) {
          userAvatarEl.innerHTML = `<img src="${currentUser.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        } else {
          userAvatarEl.textContent = App.initials(currentUser.full_name || currentUser.username);
        }
      }
    }

    // Load real-time profile data
    try {
      const profileRes = await API.get('/auth/profile/');
      const user = profileRes.data;
      localStorage.setItem('user', JSON.stringify(user));
      if (userNameEl) userNameEl.textContent = user.full_name || user.username;
      if (xpDisplayEl) {
        xpDisplayEl.textContent = `XP: ${user.xp || 0} | Daraja: ${user.level || 1}`;
      }
      if (userAvatarEl) {
        if (user.avatar) {
          userAvatarEl.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        } else {
          userAvatarEl.textContent = App.initials(user.full_name || user.username);
        }
      }
    } catch (e) {
      // silent fallback
    }

    try {
      const result = await API.get('/student/dashboard/');
      this.render(result.data);
      await this.initNotifications();
      await this.loadHomeworksBadge();
      await this.loadLeaderboard();
      this.initHomeworkListeners();
    } catch (e) {
      if (e.status === 403) {
        const role = localStorage.getItem('user_role');
        window.location.href = App.dashboardUrl(role);
        return;
      }
      window.toast?.show(e.message, 'error');
    }
  },

  switchTab(tab) {
    const mainContent = document.getElementById('dashboardMainContent');
    const savedContent = document.getElementById('savedCoursesContent');
    const homeworksContent = document.getElementById('homeworksContent');
    const dashboardBtn = document.getElementById('dashboardTabBtn');
    const savedBtn = document.getElementById('savedTabBtn');
    const homeworksBtn = document.getElementById('nav-homeworks');

    if (mainContent) mainContent.style.display = 'none';
    if (savedContent) savedContent.style.display = 'none';
    if (homeworksContent) homeworksContent.style.display = 'none';

    if (dashboardBtn) dashboardBtn.classList.remove('active');
    if (savedBtn) savedBtn.classList.remove('active');
    if (homeworksBtn) homeworksBtn.classList.remove('active');

    if (tab === 'saved') {
      if (savedContent) savedContent.style.display = 'block';
      if (savedBtn) savedBtn.classList.add('active');
      this.loadSavedCourses();
    } else if (tab === 'homeworks') {
      if (homeworksContent) homeworksContent.style.display = 'block';
      if (homeworksBtn) homeworksBtn.classList.add('active');
      this.loadStudentHomeworks();
    } else {
      if (mainContent) mainContent.style.display = 'block';
      if (dashboardBtn) dashboardBtn.classList.add('active');
    }
  },

  async loadSavedCourses() {
    const grid = document.getElementById('savedCoursesGrid');
    if (!grid) return;

    grid.innerHTML = '<p style="color:var(--text-2);font-size:13px">Yuklanmoqda...</p>';

    try {
      const res = await API.get('/courses/student/saved/');
      const courses = res.data.results || res.data || [];

      if (!courses.length) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
            <i class="ti ti-heart-broken" style="font-size: 64px; color: var(--text-3); margin-bottom: 16px; display:block;"></i>
            <p style="color:var(--text-2); font-size:15px; margin-bottom:16px;">Hali hech qanday kurs saqlamagansiz.</p>
            <a href="/courses.html" class="btn-primary" style="text-decoration:none;">Kurslarni ko'rish &rarr;</a>
          </div>
        `;
        return;
      }

      grid.innerHTML = courses.map((c) => {
        return `
          <div style="border: 2px solid var(--border); border-radius:16px; overflow:hidden; display:flex; flex-direction:column; background:var(--surface);">
            <div style="aspect-ratio: 16/9; background:#e0e0e0; position:relative;">
              ${c.thumbnail ? `<img src="${c.thumbnail}" style="width:100%;height:100%;object-fit:cover">` : ''}
              <div style="position:absolute; bottom:12px; left:12px; background:rgba(0,0,0,0.6); color:white; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:700;">
                ${c.category_name}
              </div>
            </div>
            <div style="padding:16px; flex:1; display:flex; flex-direction:column; gap:8px;">
              <h4 style="font-size:14px; font-weight:700; color:var(--text); line-height:1.4;">${c.title}</h4>
              <p style="font-size:12px; color:var(--text-2);">Ustoz: ${c.teacher_name}</p>
              <div style="margin-top:auto; display:flex; align-items:center; justify-content:space-between; padding-top:8px;">
                <span style="font-weight:700; font-size:14px; color:var(--purple);">${c.is_free ? 'Bepul' : `${Math.round(c.effective_price).toLocaleString('uz-UZ')} so'm`}</span>
                <a href="/course-detail.html?slug=${c.slug}" class="btn-primary" style="font-size:11px; padding:6px 12px; text-decoration:none;">Kurs &rarr;</a>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      grid.innerHTML = `<p style="color:var(--red); font-size:13px;">${e.message}</p>`;
    }
  },

  render(data) {
    const statCards = document.querySelectorAll('.stats-row .stat-info h3');
    if (statCards.length >= 4) {
      statCards[0].textContent = data.total_courses || 0;
      statCards[1].textContent = data.completed_courses || 0;
      
      const hours = Math.round((data.total_duration_seconds || 0) / 3600);
      statCards[2].textContent = `${hours} s`;
      statCards[3].textContent = data.certificates_count || 0;
    }

    const continueList = document.querySelector('.continue-cards');
    if (continueList) {
      const activeEnrollments = (data.enrollments || []).filter(e => !e.is_completed);
      if (activeEnrollments.length > 0) {
        continueList.innerHTML = activeEnrollments.map(e => {
          const c = e.course;
          const pct = Math.round(e.progress_percent || 0);
          return `
            <div class="c-card">
              <div class="c-top">
                <div class="c-thumb">📚</div>
                <div class="c-info">
                  <h4><a href="/course-detail.html?slug=${c.slug}" style="color:inherit;text-decoration:none">${c.title}</a></h4>
                  <p>Davom etamizmi?</p>
                </div>
              </div>
              <div>
                <div class="c-progress-text">
                  <span>Kurs progressi</span>
                  <span>${pct}%</span>
                </div>
                <div class="c-progress-bar">
                  <div class="c-progress-fill" style="width: ${pct}%"></div>
                </div>
              </div>
              <a href="/course-detail.html?slug=${c.slug}" class="btn-primary" style="text-decoration:none; padding:8px; font-size:12px; text-align:center;">Darsga kirish &rarr;</a>
            </div>
          `;
        }).join('');
      } else {
        continueList.innerHTML = '<p style="color:var(--text-2);font-size:13px;padding:12px;">Faol kurslar yo\'q. Kurs sotib olib o\'qishni boshlashingiz mumkin.</p>';
      }
    }

    const certList = document.querySelector('.cert-list');
    if (certList) {
      if (data.certificates && data.certificates.length > 0) {
        certList.innerHTML = data.certificates.map(c => `
          <div class="cert-item">
            <div style="display:flex; align-items:center; gap:8px;">
              <i class="ti ti-award"></i>
              <div style="font-size:12px; font-weight:700; color:var(--amber);">${c.course_title}</div>
            </div>
            <a href="/certificates/${c.unique_code}/" class="btn-secondary" style="font-size:11px; padding:4px 8px; text-decoration:none;">Ko'rish</a>
          </div>
        `).join('');
      } else {
        certList.innerHTML = '<p style="color:var(--text-2);font-size:13px;padding:12px;">Hali sertifikatlar yo\'q.</p>';
      }
    }

    this.loadEnrollments();
  },

  async loadEnrollments() {
    const listEl = document.querySelector('[data-enrollments-list]');
    if (!listEl) return;

    try {
      const res = await API.get('/courses/student/enrollments/');
      const enrollments = res.data.results || res.data || [];

      if (!enrollments.length) {
        listEl.innerHTML = '<p style="color:var(--text-2);font-size:13px">Hozircha hech qanday kursga yozilmagansiz.</p>';
        return;
      }

      listEl.innerHTML = enrollments.map((e) => {
        const c = e.course;
        const done = e.is_completed;
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid var(--border);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:16px;">
              <div class="c-thumb" style="width:48px;height:48px;font-size:20px;background:var(--purple-light)">📚</div>
              <div>
                <h4 style="font-size:14px;margin-bottom:4px;"><a href="/course-detail.html?slug=${c.slug}" style="color:inherit;text-decoration:none">${c.title}</a></h4>
                <div style="font-size:12px;color:${done ? 'var(--green)' : 'var(--purple)'};font-weight:500;">
                  ${done ? '<i class="ti ti-check"></i> 100% yakunlandi' : `${Math.round(e.progress_percent)}% davom etmoqda`}
                </div>
              </div>
            </div>
            ${done ? `<a href="/certificates/${c.slug}/" class="btn-secondary" style="font-size:12px;padding:6px 12px;text-decoration:none">Sertifikat</a>` : `<a href="/course-detail.html?slug=${c.slug}" class="btn-secondary" style="font-size:12px;padding:6px 12px;text-decoration:none">Davom etish</a>`}
          </div>
        `;
      }).join('');
    } catch (e) {
      listEl.innerHTML = `<p style="color:var(--red)">${e.message}</p>`;
    }
  },

  // ── STUDENT HOMEWORKS TABS ──
  async loadHomeworksBadge() {
    try {
      const res = await API.get('/courses/student/homeworks/');
      const homeworks = res.data;
      const pending = homeworks.filter(h => !h.my_submission || h.my_submission.status === 'pending').length;
      
      const badge = document.getElementById('pendingHwBadge');
      if (badge) {
        if (pending > 0) {
          badge.textContent = pending;
          badge.style.display = 'inline-flex';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) {
      // silent
    }
  },

  async loadStudentHomeworks() {
    const listContainer = document.getElementById('studentHomeworkList');
    if (listContainer) {
      listContainer.innerHTML = '<p style="color:var(--text-2);font-size:13px;padding:20px;">Yuklanmoqda...</p>';
    }

    try {
      const res = await API.get('/courses/student/homeworks/');
      const homeworks = res.data;
      this.allHomeworks = homeworks;

      // Mini stats
      const total = homeworks.length;
      const done = homeworks.filter(h => h.my_submission?.status === 'reviewed').length;
      const waiting = homeworks.filter(h => h.my_submission?.status === 'submitted').length;
      const pending = homeworks.filter(h => !h.my_submission || h.my_submission.status === 'pending').length;

      const statsRow = document.getElementById('hwStatsRow');
      if (statsRow) {
        statsRow.innerHTML = `
          <div class="hw-stat-card"><span>${total}</span><small>Jami</small></div>
          <div class="hw-stat-card green"><span>${done}</span><small>Tekshirilgan</small></div>
          <div class="hw-stat-card amber"><span>${waiting}</span><small>Kutilmoqda</small></div>
          <div class="hw-stat-card red"><span>${pending}</span><small>Topshirilgan</small></div>`;
      }

      // Populate courses filter dropdown
      const courseFilter = document.getElementById('hwCourseFilter');
      if (courseFilter) {
        const uniqueCourses = [...new Map(homeworks.map(h => [h.course_id, h.course_title])).entries()];
        courseFilter.innerHTML = `<option value="">Barcha kurslar</option>` + uniqueCourses.map(([id, title]) => `
          <option value="${id}">${title}</option>
        `).join('');
      }

      // Sidebar badge refresh
      const badge = document.getElementById('pendingHwBadge');
      if (badge) {
        if (pending > 0) {
          badge.textContent = pending;
          badge.style.display = 'inline-flex';
        } else {
          badge.style.display = 'none';
        }
      }

      const activeTab = document.querySelector('.filter-chip.active');
      const statusFilter = activeTab ? activeTab.dataset.hwStatus : 'all';
      this.renderHomeworkList(homeworks, statusFilter);
    } catch (e) {
      if (listContainer) {
        listContainer.innerHTML = `<p style="color:var(--red); font-size:13px;">${e.message}</p>`;
      }
    }
  },

  renderHomeworkList(homeworks, statusFilter) {
    const container = document.getElementById('studentHomeworkList');
    if (!container) return;

    const selectedCourseId = document.getElementById('hwCourseFilter')?.value || '';

    let list = homeworks;
    if (selectedCourseId) {
      list = list.filter(h => h.course_id === parseInt(selectedCourseId));
    }

    const filtered = statusFilter === 'all'
      ? list
      : list.filter(h => (h.my_submission?.status || 'pending') === statusFilter);

    if (!filtered.length) {
      container.innerHTML = `<div class="empty-state">📋 Bu toifada vazifalar yo'q.</div>`;
      return;
    }

    container.innerHTML = filtered.map(hw => {
      const status = hw.my_submission?.status || 'pending';
      const score = hw.my_submission?.teacher_score;
      const feedback = hw.my_submission?.feedback;

      const statusInfo = {
        pending:   { icon:'❌', label:'Topshirilgan', cls:'pending' },
        submitted: { icon:'⏳', label:'Tekshirilmoqda', cls:'waiting' },
        reviewed:  { icon:'✅', label:`Tekshirildi — ${score}/100`, cls:'reviewed' }
      }[status];

      return `
        <div class="hw-list-card">
          <div class="hw-list-left">
            <div class="hw-list-course">${hw.course_title}</div>
            <div class="hw-list-title">${hw.title}</div>
            ${hw.deadline_days ? `<div class="hw-list-deadline">⏰ ${hw.deadline_days} kun muddat</div>` : ''}
            ${status === 'reviewed' && feedback ? `
              <div class="hw-teacher-feedback">
                <span class="feedback-label">💬 Ustoz izohi:</span>
                <span class="feedback-text">"${feedback}"</span>
              </div>` : ''}
          </div>
          <div class="hw-list-right">
            <span class="hw-badge ${statusInfo.cls}">${statusInfo.icon} ${statusInfo.label}</span>
            ${status === 'reviewed' && score !== null ? `
              <div class="hw-score-display">
                <svg viewBox="0 0 60 60" width="60" height="60">
                  <circle cx="30" cy="30" r="24" fill="none" stroke="var(--border)" stroke-width="5"/>
                  <circle cx="30" cy="30" r="24" fill="none" stroke="${score >= 70 ? 'var(--green)' : 'var(--red-mid)'}"
                          stroke-width="5"
                          stroke-dasharray="${2*Math.PI*24}"
                          stroke-dashoffset="${2*Math.PI*24 * (1 - score/100)}"
                          stroke-linecap="round"
                          transform="rotate(-90 30 30)"/>
                  <text x="30" y="35" text-anchor="middle" font-size="13" font-weight="700"
                        fill="${score >= 70 ? 'var(--green)' : 'var(--red-mid)'}">${score}</text>
                </svg>
              </div>` : ''}
            <a href="homework.html?id=${hw.id}" class="btn-${status === 'reviewed' ? 'primary' : status === 'submitted' ? 'secondary' : 'primary'}" style="text-decoration:none;">
              ${status === 'reviewed' ? 'Batafsil &rarr;' : status === 'submitted' ? 'Ko\'rish' : 'Boshlash &rarr;'}
            </a>
          </div>
        </div>`;
    }).join('');
  },

  initHomeworkListeners() {
    document.querySelectorAll('[data-hw-status]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-hw-status]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.renderHomeworkList(this.allHomeworks, chip.dataset.hwStatus);
      });
    });

    const filterDropdown = document.getElementById('hwCourseFilter');
    if (filterDropdown) {
      filterDropdown.addEventListener('change', () => {
        const activeTab = document.querySelector('.filter-chip.active');
        const statusFilter = activeTab ? activeTab.dataset.hwStatus : 'all';
        this.renderHomeworkList(this.allHomeworks, statusFilter);
      });
    }
  },

  // ── O'QUVCHI NOTIFICATION SYSTEM ──
  async initNotifications() {
    const bell = document.getElementById('studentNotifBell');
    const dropdown = document.getElementById('studentNotifDropdown');
    const readAllBtn = document.getElementById('studentReadAllBtn');

    if (bell && dropdown) {
      bell.addEventListener('click', (e) => {
        e.stopPropagation();
        const show = dropdown.style.display === 'block';
        dropdown.style.display = show ? 'none' : 'block';
        if (!show) {
          this.loadStudentNotifications();
        }
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.notif-wrapper')) {
          dropdown.style.display = 'none';
        }
      });
    }

    if (readAllBtn) {
      readAllBtn.addEventListener('click', async () => {
        await API.post('/notifications/read-all/');
        this.loadStudentNotifCount();
        this.loadStudentNotifications();
      });
    }

    await this.loadStudentNotifCount();
    setInterval(() => this.loadStudentNotifCount(), 30000);
  },

  async loadStudentNotifCount() {
    try {
      const res = await API.get('/notifications/unread-count/');
      const count = res.data.count;
      const badge = document.getElementById('studentNotifBadge');
      if (badge) {
        if (count > 0) {
          badge.textContent = count > 9 ? '9+' : count;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch(e) {
      // silent
    }
  },

  async loadStudentNotifications() {
    const list = document.getElementById('studentNotifList');
    if (!list) return;

    try {
      const res = await API.get('/notifications/');
      const notifications = res.data.results || res.data;

      if (!notifications || !notifications.length) {
        list.innerHTML = `<div class="notif-empty">Hozircha bildirishnoma yo'q</div>`;
        return;
      }

      list.innerHTML = notifications.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}"
             onclick="DashboardStudent.handleStudentNotifClick(${n.id}, '${n.link || ''}')">
          <span class="notif-type-icon">${this.studentNotifIcon(n.type)}</span>
          <div class="notif-text">
            <div class="notif-title" style="font-weight:700;">${n.title || 'Bildirishnoma'}</div>
            <div class="notif-msg">${n.message}</div>
            <div class="notif-time">${this.timeAgo(n.created_at)}</div>
          </div>
          ${!n.is_read ? '<span class="notif-dot"></span>' : ''}
        </div>`).join('');
    } catch (e) {
      list.innerHTML = `<div class="notif-empty" style="color:var(--rose)">Xatolik yuz berdi.</div>`;
    }
  },

  studentNotifIcon(type) {
    const icons = {
      homework_reviewed: '✅',
      new_message:       '💬',
      new_enrollment:    '🎓',
      quiz_completed:    '📝',
    };
    return icons[type] || '🔔';
  },

  async handleStudentNotifClick(id, link) {
    try {
      await API.post(`/notifications/${id}/read/`);
      this.loadStudentNotifCount();
      if (link) {
        window.location.href = link;
      }
    } catch (e) {
      // silent
    }
  },

  timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return `${diff} soniya oldin`;
    if (diff < 3600) return `${Math.floor(diff/60)} daqiqa oldin`;
    if (diff < 86400) return `${Math.floor(diff/3600)} soat oldin`;
    return `${Math.floor(diff/86400)} kun oldin`;
  },

  async loadLeaderboard() {
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;

    try {
      const res = await API.get('/auth/leaderboard/');
      const leaderboard = res.data.leaderboard || [];
      
      if (!leaderboard.length) {
        listEl.innerHTML = '<p style="color:var(--text-2);font-size:13px">Hozircha ma\'lumot yo\'q</p>';
        return;
      }

      listEl.innerHTML = leaderboard.map(u => {
        const highlightStyle = u.is_self ? 'background: var(--purple-light); font-weight: bold; border-radius: 8px; padding: 4px 8px;' : '';
        return `
          <div class="leaderboard-item" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border); ${highlightStyle}">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700; width: 20px; text-align: center;">${u.rank}</span>
              <span style="font-size: 13px;">${u.full_name}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="hw-badge" style="background: var(--purple-light); color: var(--purple); font-size: 11px;">Lv. ${u.level}</span>
              <span style="font-weight: 600; font-size: 12px; color: var(--text-2);">${u.xp} XP</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      listEl.innerHTML = `<p style="color:var(--red); font-size:13px;">Natijalarni yuklab bo'lmadi</p>`;
    }
  }
};

// Bind to window to allow inline onclick handlers in HTML
window.DashboardStudent = StudentDashboard;
document.addEventListener('DOMContentLoaded', () => StudentDashboard.init());
