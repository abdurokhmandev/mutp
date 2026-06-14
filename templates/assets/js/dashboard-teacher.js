// dashboard-teacher.js — Ustoz boshqaruv paneli
const TeacherDashboard = {
  chart: null,
  currentHwId: null,
  currentSubmissionId: null,
  allHomeworks: [],

  async init() {
    if (!App.requireAuth(['teacher'])) return;
    App.updateNav();
    this.updateSidebar();

    try {
      await this.loadDashboard();
      await this.initNotifications();
      await this.initHomeworks();
    } catch (e) {
      if (e.status === 403) {
        if (e.message?.includes('tasdiqlanmagan')) {
          window.toast?.show(e.message, 'error');
          return;
        }
        window.location.href = App.dashboardUrl(localStorage.getItem('user_role'));
        return;
      }
      window.toast?.show(e.message || "Ma'lumot yuklanmadi", 'error');
    }
  },

  async loadDashboard() {
    const [dashRes, coursesRes] = await Promise.all([
      API.get('/courses/teacher/dashboard/'),
      API.get('/courses/teacher/courses/'),
    ]);
    this.renderDashboard(dashRes.data);
    this.renderCourses(coursesRes.data);
  },

  updateSidebar() {
    const user = App.getUser();
    if (!user) return;
    const nameEl = document.querySelector('[data-user-name]');
    const avatarEl = document.querySelector('[data-user-avatar]');
    if (nameEl) nameEl.textContent = user.full_name || user.email;
    if (avatarEl) avatarEl.textContent = App.initials(user.full_name);
  },

  renderDashboard(data) {
    const welcome = document.querySelector('.dashboard-header p');
    const user = App.getUser();
    if (welcome && user) {
      welcome.textContent = `Xush kelibsiz, ${user.full_name?.split(' ')[0] || user.full_name}!`;
    }

    const statCards = document.querySelectorAll('.stats-row .stat-info h3');
    if (statCards.length >= 4) {
      statCards[0].textContent = (data.total_students || 0).toLocaleString('uz-UZ');
      statCards[1].textContent = data.total_courses || 0;
      statCards[2].textContent = (data.average_rating || 0).toFixed(1);
      const lastMonth = data.monthly_earnings?.[data.monthly_earnings.length - 1];
      statCards[3].textContent = lastMonth ? Math.round(lastMonth.amount).toLocaleString('uz-UZ') : '0';
    }

    const studentList = document.querySelector('.student-list');
    if (studentList && data.recent_enrollments?.length) {
      const colors = [
        { bg: 'var(--purple-light)', fg: 'var(--purple)' },
        { bg: 'var(--green-light)', fg: 'var(--green)' },
        { bg: 'var(--amber-light)', fg: 'var(--amber)' },
        { bg: 'var(--duo-green-bg)', fg: 'var(--duo-green)' },
        { bg: 'var(--red-light)', fg: 'var(--red)' },
      ];
      studentList.innerHTML = data.recent_enrollments.slice(0, 5).map((e, i) => {
        const c = colors[i % colors.length];
        const pct = Math.round(e.progress_percent || 0);
        return `
          <div class="student-item">
            <div class="st-av" style="background:${c.bg};color:${c.fg}">${App.initials(e.student_name)}</div>
            <div style="flex:1;min-width:0">
              <div class="st-name">${e.student_name}</div>
              <div class="st-course">${e.course_title}</div>
            </div>
            <div class="prog-wrap">
              <div class="prog-pct" style="color:${c.fg}">${pct}%</div>
              <div class="prog-bar"><div class="prog-fill" style="width:${pct}%;background:${c.fg}"></div></div>
            </div>
          </div>
        `;
      }).join('');
    } else if (studentList) {
      studentList.innerHTML = '<p style="padding:20px;color:var(--text-2);font-size:13px">Hali o\'quvchilar yo\'q</p>';
    }

    this.renderChart(data.monthly_earnings || []);
  },

  renderCourses(courses) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    if (!courses.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-2);padding:32px">Hali kurslar yo\'q. <a href="/create-course.html" style="color:var(--purple)">Yangi kurs qo\'shing</a></td></tr>';
      return;
    }

    tbody.innerHTML = courses.map((c) => {
      const isPublished = c.status_display === 'Chop etilgan' || c.status === 'published';
      return `
        <tr>
          <td style="font-weight:500;">${c.title}</td>
          <td>${c.students_count || c.student_count || 0}</td>
          <td>★ ${(c.rating || c.average_rating || 0).toFixed(1)}</td>
          <td>${Math.round(c.earnings || 0).toLocaleString('uz-UZ')}</td>
          <td><span class="pill ${isPublished ? 'pill-green' : 'pill-amber'}">${c.status_display || 'Qoralama'}</span></td>
          <td style="display:flex;gap:8px;align-items:center;">
            <a href="/create-course.html?slug=${c.slug}" style="color:var(--purple);text-decoration:none;font-size:12px">Tahrirlash</a>
            <button onclick="TeacherDashboard.deleteCourse('${c.slug}', '${c.title.replace(/'/g, "\\'")}')"
              style="background:none;border:none;cursor:pointer;color:var(--rose);font-size:12px;padding:0;display:flex;align-items:center;gap:3px;"
              title="O'chirish">
              <i class="ti ti-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async deleteCourse(slug, title) {
    const confirmed = confirm(`"${title}" kursini o'chirmoqchimisiz?\n\nBarcha darslar va vazifalar ham o'chib ketadi!`);
    if (!confirmed) return;
    try {
      await API.delete(`/courses/teacher/courses/${slug}/`);
      window.toast?.show("Kurs o'chirildi!", 'success');
      await this.loadDashboard();
    } catch (e) {
      window.toast?.show(e.message || "O'chirishda xatolik!", 'error');
    }
  },

  renderChart(monthly) {
    const canvas = document.getElementById('revenueChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const labels = monthly.map((m) => {
      const [y, mo] = m.month.split('-');
      const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
      return months[parseInt(mo, 10) - 1] || m.month;
    });
    const values = monthly.map((m) => m.amount);

    if (this.chart) this.chart.destroy();
    this.chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: "Daromad (so'm)",
          data: values,
          backgroundColor: '#534AB7',
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false } },
          x: { grid: { display: false }, border: { display: false } },
        },
      },
    });
  },

  // ── Notifications Section ──
  async initNotifications() {
    const bell = document.getElementById('notifBell');
    const dropdown = document.getElementById('notifDropdown');
    
    if (bell && dropdown) {
      bell.addEventListener('click', (e) => {
        e.stopPropagation();
        const show = dropdown.style.display === 'block';
        dropdown.style.display = show ? 'none' : 'block';
        if (!show) {
          this.loadNotifications();
        }
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.notif-wrapper')) {
          dropdown.style.display = 'none';
        }
      });
    }

    await this.loadUnreadCount();
    setInterval(() => this.loadUnreadCount(), 30000);
  },

  async loadUnreadCount() {
    try {
      const res = await API.get('/notifications/unread-count/');
      const count = res.data.count;
      const badge = document.getElementById('notifBadge');
      if (badge) {
        if (count > 0) {
          badge.textContent = count > 9 ? '9+' : count;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) {
      // silent fail
    }
  },

  async loadNotifications() {
    try {
      const res = await API.get('/notifications/');
      const notifications = res.data.results || res.data;
      this.renderNotifDropdown(notifications);
    } catch (e) {
      // silent
    }
  },

  renderNotifDropdown(notifications) {
    const list = document.getElementById('notifList');
    if (!list) return;

    if (!notifications || notifications.length === 0) {
      list.innerHTML = `<div class="notif-empty" style="padding: 24px; text-align: center; color: var(--text-2); font-size: 13px;">Bildirishnomalar yo'q</div>`;
      return;
    }

    list.innerHTML = notifications.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="TeacherDashboard.handleNotifClick(${n.id}, '${n.link}')">
        <span class="notif-type-icon">${this.notifIcon(n.type)}</span>
        <div class="notif-text">
          <div class="notif-title" style="font-weight: 700;">${n.title || 'Bildirishnoma'}</div>
          <div class="notif-msg">${n.message}</div>
          <div class="notif-time">${this.timeAgo(n.created_at)}</div>
        </div>
      </div>`).join('');
  },

  async handleNotifClick(id, link) {
    try {
      await API.post(`/notifications/${id}/read/`);
      this.loadUnreadCount();
      if (link) {
        window.location.href = link;
      }
    } catch (e) {
      // silent
    }
  },

  notifIcon(type) {
    const icons = {
      new_enrollment: '👨‍🎓',
      quiz_completed: '📝',
      homework_submitted: '📋',
      new_message: '💬',
      homework_reviewed: '✅'
    };
    return icons[type] || '🔔';
  },

  timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return `${diff} soniya oldin`;
    if (diff < 3600) return `${Math.floor(diff/60)} daqiqa oldin`;
    if (diff < 86400) return `${Math.floor(diff/3600)} soat oldin`;
    return `${Math.floor(diff/86400)} kun oldin`;
  },

  // ── Teacher Homeworks System ──
  async initHomeworks() {
    const courseFilter = document.getElementById('hwCourseFilter');
    const statusFilter = document.getElementById('hwStatusFilter');

    if (courseFilter) {
      courseFilter.addEventListener('change', () => this.filterHomeworks());
    }
    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.filterHomeworks());
    }

    try {
      const coursesRes = await API.get('/courses/teacher/courses/');
      const courses = coursesRes.data;
      if (courseFilter) {
        courseFilter.innerHTML = `<option value="">Barcha kurslar</option>` + courses.map(c => `
          <option value="${c.title}">${c.title}</option>
        `).join('');
      }

      await this.loadHomeworks();
    } catch (e) {
      // silent fail
    }
  },

  async loadHomeworks() {
    try {
      const res = await API.get('/teacher/homeworks/');
      const homeworks = res.data;
      this.allHomeworks = homeworks;

      // Update pending badge in sidebar
      const pendingCount = homeworks.reduce((acc, h) => acc + (h.submission_count || 0), 0);
      const pendingHwBadge = document.getElementById('pendingHwBadge');
      if (pendingHwBadge) {
        if (pendingCount > 0) {
          pendingHwBadge.textContent = pendingCount;
          pendingHwBadge.style.display = 'inline-block';
        } else {
          pendingHwBadge.style.display = 'none';
        }
      }

      this.filterHomeworks();
    } catch (e) {
      // silent fail
    }
  },

  filterHomeworks() {
    const courseTitle = document.getElementById('hwCourseFilter')?.value || '';
    const status = document.getElementById('hwStatusFilter')?.value || '';

    let list = this.allHomeworks;
    if (courseTitle) {
      list = list.filter(h => h.course_title === courseTitle);
    }
    
    // Status filter: pending works are homeworks that have submissions
    if (status === 'pending') {
      list = list.filter(h => h.submission_count > 0);
    } else if (status === 'reviewed') {
      list = list.filter(h => h.submission_count === 0);
    }

    this.renderHomeworkList(list);
  },

  renderHomeworkList(homeworks) {
    const container = document.getElementById('teacherHwList');
    if (!container) return;

    if (!homeworks || homeworks.length === 0) {
      container.innerHTML = `<p style="text-align: center; color: var(--text-2); font-size: 13px; padding: 24px;">Topshiriqlar topilmadi.</p>`;
      return;
    }

    container.innerHTML = homeworks.map(hw => `
      <div class="teacher-hw-row">
        <div class="teacher-hw-info">
          <div class="teacher-hw-title">📝 ${hw.title}</div>
          <div class="teacher-hw-meta">${hw.course_title} · ${hw.submission_count} ta yangi topshiriq keldi</div>
        </div>
        <button class="review-btn" onclick="TeacherDashboard.loadSubmissions(${hw.id}, '${hw.title.replace(/'/g, "\\'")}')">Ko'rish &rarr;</button>
      </div>`).join('');
  },

  async loadSubmissions(hwId, hwTitle) {
    this.currentHwId = hwId;
    const subContainer = document.getElementById('hwSubmissionsContainer');
    const subList = document.getElementById('submissionsList');
    const subTitle = document.getElementById('submissionsTitle');

    if (!subContainer || !subList) return;

    subTitle.textContent = `"${hwTitle || 'Vazifa'}" topshiriqlari`;
    subContainer.style.display = 'block';
    subList.innerHTML = `<p style="padding:12px; font-size:13px; color:var(--text-2);">Yuklanmoqda...</p>`;

    try {
      const res = await API.get(`/teacher/homeworks/${hwId}/submissions/`);
      const submissions = res.data;

      if (!submissions || submissions.length === 0) {
        subList.innerHTML = `<p style="padding:12px; font-size:13px; color:var(--text-2);">Topshiriqlar yuborilmagan.</p>`;
        return;
      }

      subList.innerHTML = submissions.map(sub => {
        const studentInitials = App.initials(sub.student_name);
        const statusLabel = sub.status === 'submitted' ? 'Tekshirilmagan' : 'Tekshirilgan';
        const dateStr = sub.completed_at ? new Date(sub.completed_at).toLocaleDateString() : '';
        return `
          <div class="submission-card">
            <div class="submission-student">
              <span class="st-av" style="background:var(--purple-light); color:var(--purple); width:28px; height:28px; font-size:10px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; margin-right:6px;">${studentInitials}</span>
              <span>${sub.student_name}</span>
            </div>
            <div class="submission-status ${sub.status}">${statusLabel}</div>
            <div class="submission-date">${dateStr}</div>
            <button class="review-btn" onclick="TeacherDashboard.openReview(${sub.id}, '${sub.student_name.replace(/'/g, "\\'")}', '${(sub.text_answer || '').replace(/'/g, "\\'")}', '${sub.file_answer || ''}', '${sub.feedback || ''}', ${sub.teacher_score || ''})">Ko'rish va izoh ✏️</button>
          </div>`;
      }).join('');
    } catch (e) {
      window.toast?.show("Topshiriqlarni yuklashda xatolik", "error");
    }
  },

  openReview(subId, studentName, textAnswer, fileAnswer, feedback, score) {
    this.currentSubmissionId = subId;
    
    document.getElementById('reviewAnswerText').textContent = textAnswer || 'Matnli javob yozilmagan.';
    
    const fileLink = document.getElementById('reviewAnswerFile');
    if (fileAnswer) {
      fileLink.href = fileAnswer;
      fileLink.style.display = 'inline-block';
    } else {
      fileLink.style.display = 'none';
    }

    document.getElementById('reviewFeedback').value = feedback || '';
    document.getElementById('reviewScore').value = score || '';

    document.getElementById('reviewModal').style.display = 'flex';
  }
};

function closeReview() {
  document.getElementById('reviewModal').style.display = 'none';
}

async function submitReview() {
  const subId = TeacherDashboard.currentSubmissionId;
  const feedback = document.getElementById('reviewFeedback').value;
  const score = parseInt(document.getElementById('reviewScore').value);

  if (!feedback) {
    window.toast?.show("Iltimos, o'quvchiga izoh yozing.", "warning");
    return;
  }
  if (isNaN(score) || score < 0 || score > 100) {
    window.toast?.show("Ball 0 va 100 oralig'ida bo'lishi kerak.", "warning");
    return;
  }

  try {
    await API.post(`/teacher/homeworks/submissions/${subId}/review/`, { feedback, score });
    window.toast?.show("Izoh yuborildi — o'quvchiga notification ketdi", "success");
    closeReview();
    // Reload lists
    await TeacherDashboard.loadHomeworks();
    if (TeacherDashboard.currentHwId) {
      await TeacherDashboard.loadSubmissions(TeacherDashboard.currentHwId);
    }
  } catch (err) {
    window.toast?.show(err.message || "Tekshirishni saqlashda xatolik yuz berdi", "error");
  }
}

document.addEventListener('DOMContentLoaded', () => TeacherDashboard.init());
