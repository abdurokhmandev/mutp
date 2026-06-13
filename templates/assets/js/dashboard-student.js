// dashboard-student.js — o'quvchi boshqaruv paneli va saqlangan kurslar
const StudentDashboard = {
  async init() {
    if (!App.requireAuth(['student'])) return;
    App.updateNav();

    // Set global click handler for logo-name to render avatar initials
    const userAvatarEl = document.querySelector('[data-user-avatar]');
    const userNameEl = document.querySelector('[data-user-name]');
    
    // User profile sidebar details loading
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (currentUser) {
      if (userNameEl) userNameEl.textContent = currentUser.full_name || currentUser.username;
      if (userAvatarEl) {
        if (currentUser.avatar) {
          userAvatarEl.innerHTML = `<img src="${currentUser.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        } else {
          userAvatarEl.textContent = App.initials(currentUser.full_name || currentUser.username);
        }
      }
    }

    try {
      const result = await API.get('/student/dashboard/');
      this.render(result.data);
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
    const dashboardBtn = document.getElementById('dashboardTabBtn');
    const savedBtn = document.getElementById('savedTabBtn');

    if (tab === 'saved') {
      if (mainContent) mainContent.style.display = 'none';
      if (savedContent) savedContent.style.display = 'block';
      if (dashboardBtn) dashboardBtn.classList.remove('active');
      if (savedBtn) savedBtn.classList.add('active');
      this.loadSavedCourses();
    } else {
      if (mainContent) mainContent.style.display = 'block';
      if (savedContent) savedContent.style.display = 'none';
      if (dashboardBtn) dashboardBtn.classList.add('active');
      if (savedBtn) savedBtn.classList.remove('active');
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
        const isFree = c.is_free || Number(c.effective_price) === 0;
        const priceText = isFree ? 'Bepul' : `${Number(c.effective_price || c.price).toLocaleString('uz-UZ')} so'm`;
        const rating = c.average_rating ? c.average_rating.toFixed(1) : '—';
        const students = c.student_count || 0;

        let thumbHtml = '';
        if (c.thumbnail) {
          thumbHtml = `<img src="${c.thumbnail}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
          thumbHtml = `<div style="width:100%;height:100%;background:linear-gradient(135deg, var(--duo-green-bg), var(--duo-green));display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;">EduUz</div>`;
        }

        return `
          <div class="c-card" style="position:relative; min-width:unset; width:100%;">
            <!-- Remove from saved button (✕) -->
            <button onclick="StudentDashboard.removeSavedCourse('${c.slug}')" style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.5); border:none; color:white; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10; font-size:12px;" title="Saqlanganlardan o'chirish">
              <i class="ti ti-x"></i>
            </button>

            <a href="/course-detail.html?slug=${c.slug}" style="text-decoration:none; color:inherit; display:flex; flex-direction:column; gap:12px;">
              <div class="c-top">
                <div class="c-thumb" style="width:64px; height:64px; border-radius:12px; overflow:hidden;">${thumbHtml}</div>
                <div class="c-info" style="flex:1;">
                  <h4 style="font-size:14px; font-weight:700; color:var(--text);">${c.title}</h4>
                  <p style="font-size:12px; color:var(--text-2); margin-top:2px;">Ustoz: ${c.teacher_name}</p>
                </div>
              </div>
              
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; border-top: 1px solid var(--border); padding-top:10px; margin-top:4px;">
                <span style="color:var(--amber); font-weight:600;"><i class="ti ti-star-filled"></i> ${rating} (${students})</span>
                <span style="font-weight:700; color:${isFree ? 'var(--green)' : 'var(--purple)'}">${priceText}</span>
              </div>
            </a>
          </div>
        `;
      }).join('');

    } catch (e) {
      grid.innerHTML = `<p style="color:var(--red);padding:20px">${e.message}</p>`;
    }
  },

  async removeSavedCourse(slug) {
    if (!confirm("Ushbu kursni saqlanganlardan olib tashlamoqchimisiz?")) return;
    try {
      await API.post(`/courses/${slug}/save/`);
      window.toast?.show("Kurs saqlanganlardan olib tashlandi", 'info');
      this.loadSavedCourses();
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  render(data) {
    const { user, stats, weekly_activity, in_progress_courses, recent_certificates } = data;

    const welcome = document.querySelector('.welcome-text');
    if (welcome) welcome.textContent = `Kabinetga xush kelibsiz, ${user.full_name?.split(' ')[0] || ''}!`;

    const statCards = document.querySelectorAll('.stats-row .stat-info h3');
    if (statCards.length >= 4) {
      statCards[0].textContent = stats.total_enrolled;
      statCards[1].textContent = stats.completed_courses;
      statCards[2].textContent = `${stats.total_hours_studied}s`;
      statCards[3].textContent = stats.certificates_count;
    }

    const continueEl = document.querySelector('.continue-cards');
    if (continueEl) {
      if (!in_progress_courses.length) {
        continueEl.innerHTML = '<p style="color:var(--text-2);font-size:13px;">Davom etayotgan kurslar yo\'q. <a href="/courses.html" style="color:var(--duo-green);font-weight:600;text-decoration:none">Kurs tanlang</a></p>';
      } else {
        continueEl.innerHTML = in_progress_courses.map((c) => `
          <div class="c-card">
            <div class="c-top">
              <div class="c-thumb">${c.thumbnail ? `<img src="${c.thumbnail}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">` : '📚'}</div>
              <div class="c-info">
                <h4>${c.course_title}</h4>
                <p>${c.last_lesson_title || 'Birinchi dars'}</p>
              </div>
            </div>
            <div>
              <div class="c-progress-text"><span>${Math.round(c.progress_percent)}% yakunlandi</span></div>
              <div class="c-progress-bar"><div class="c-progress-fill" style="width:${c.progress_percent}%"></div></div>
            </div>
            <a href="/lesson.html?id=${c.last_lesson_id}" class="btn-primary" style="width:100%;text-align:center;text-decoration:none">Davom etish</a>
          </div>
        `).join('');
      }
    }

    this.loadEnrollments();

    const activityGrid = document.querySelector('.activity-grid');
    const actLabels = document.querySelector('.act-labels');
    if (activityGrid && weekly_activity?.length) {
      const maxSec = Math.max(...weekly_activity.map((d) => d.seconds), 1);
      activityGrid.innerHTML = weekly_activity.map((d) => {
        const lvl = d.seconds === 0 ? '' : d.seconds < maxSec * 0.25 ? 'l1' : d.seconds < maxSec * 0.5 ? 'l2' : d.seconds < maxSec * 0.75 ? 'l3' : 'l4';
        return `<div class="act-day ${lvl}" title="${d.seconds}s"></div>`;
      }).join('');
      if (actLabels) {
        actLabels.innerHTML = weekly_activity.map((d) => `<span>${d.day}</span>`).join('');
      }
    }

    const certList = document.querySelector('.cert-list');
    if (certList) {
      if (!recent_certificates?.length) {
        certList.innerHTML = '<p style="font-size:13px;color:var(--text-2)">Hali sertifikatlar yo\'q</p>';
      } else {
        certList.innerHTML = recent_certificates.map((c) => `
          <div class="cert-item">
            <div style="display:flex;align-items:center;gap:12px;">
              <i class="ti ti-certificate"></i>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text)">${c.course_title}</div>
                <div style="font-size:11px;color:var(--text-2)">${App.formatDate(c.issued_at)}</div>
              </div>
            </div>
            <a href="/courses/certificates/${c.unique_code}/" style="color:var(--text-2)"><i class="ti ti-download"></i></a>
          </div>
        `).join('');
      }
    }
  },

  async loadEnrollments(status = '') {
    const listEl = document.querySelector('[data-enrollments-list]');
    if (!listEl) return;

    try {
      const url = '/courses/student/enrollments/' + (status ? `?status=${status}` : '');
      const result = await API.get(url);
      const enrollments = result.data || [];

      if (!enrollments.length) {
        listEl.innerHTML = '<p style="color:var(--text-2);font-size:13px">Kurslar topilmadi</p>';
        return;
      }

      listEl.innerHTML = enrollments.map((e) => {
        const c = e.course;
        const done = e.is_completed;
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid var(--border);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:16px;">
              <div class="c-thumb" style="width:48px;height:48px;font-size:20px;background:var(--blue-light)">📚</div>
              <div>
                <h4 style="font-size:14px;margin-bottom:4px;"><a href="/course-detail.html?slug=${c.slug}" style="color:inherit;text-decoration:none">${c.title}</a></h4>
                <div style="font-size:12px;color:${done ? 'var(--green)' : 'var(--purple)'};font-weight:500;">
                  ${done ? '<i class="ti ti-check"></i> 100% yakunlandi' : `${Math.round(e.progress_percent)}% davom etmoqda`}
                </div>
              </div>
            </div>
            ${done ? '<span style="font-size:12px;color:var(--muted)">Sertifikat</span>' : `<a href="/course-detail.html?slug=${c.slug}" class="btn-secondary" style="font-size:12px;padding:6px 12px;text-decoration:none">Davom etish</a>`}
          </div>
        `;
      }).join('');
    } catch (e) {
      listEl.innerHTML = `<p style="color:var(--red)">${e.message}</p>`;
    }
  },
};

// Bind to window to allow inline onclick handlers in HTML
window.DashboardStudent = StudentDashboard;
document.addEventListener('DOMContentLoaded', () => StudentDashboard.init());
