// dashboard-student.js
const StudentDashboard = {
  async init() {
    if (!App.requireAuth(['student'])) return;
    App.updateNav();

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
        continueEl.innerHTML = '<p style="color:var(--muted);font-size:14px;">Davom etayotgan kurslar yo\'q. <a href="/courses.html">Kurs tanlang</a></p>';
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
        certList.innerHTML = '<p style="font-size:13px;color:var(--muted)">Hali sertifikatlar yo\'q</p>';
      } else {
        certList.innerHTML = recent_certificates.map((c) => `
          <div class="cert-item">
            <div style="display:flex;align-items:center;gap:12px;">
              <i class="ti ti-certificate"></i>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--ink)">${c.course_title}</div>
                <div style="font-size:11px;color:var(--muted)">${App.formatDate(c.issued_at)}</div>
              </div>
            </div>
            <a href="/courses/certificates/${c.unique_code}/" style="color:var(--ink-2)"><i class="ti ti-download"></i></a>
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
        listEl.innerHTML = '<p style="color:var(--muted);font-size:14px">Kurslar topilmadi</p>';
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
                <div style="font-size:12px;color:${done ? 'var(--green)' : 'var(--blue)'};font-weight:500;">
                  ${done ? '<i class="ti ti-check"></i> 100% yakunlandi' : `${Math.round(e.progress_percent)}% davom etmoqda`}
                </div>
              </div>
            </div>
            ${done ? '<span style="font-size:12px;color:var(--muted)">Sertifikat</span>' : `<a href="/course-detail.html?slug=${c.slug}" class="btn-secondary" style="font-size:12px;padding:6px 12px;text-decoration:none">Davom etish</a>`}
          </div>
        `;
      }).join('');
    } catch (e) {
      listEl.innerHTML = `<p style="color:var(--rose)">${e.message}</p>`;
    }
  },
};

document.addEventListener('DOMContentLoaded', () => StudentDashboard.init());
