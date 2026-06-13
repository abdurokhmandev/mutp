// dashboard-teacher.js — Ustoz boshqaruv paneli
const TeacherDashboard = {
  chart: null,

  async init() {
    if (!App.requireAuth(['teacher'])) return;
    App.updateNav();
    this.updateSidebar();

    try {
      const [dashRes, coursesRes] = await Promise.all([
        API.get('/courses/teacher/dashboard/'),
        API.get('/courses/teacher/courses/'),
      ]);
      this.renderDashboard(dashRes.data);
      this.renderCourses(coursesRes.data);
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

  updateSidebar() {
    const user = App.getUser();
    if (!user) return;
    const nameEl = document.querySelector('[data-user-name]');
    const avatarEl = document.querySelector('[data-user-avatar]');
    if (nameEl) nameEl.textContent = user.full_name || user.email;
    if (avatarEl) avatarEl.textContent = App.initials(user.full_name);
  },

  renderDashboard(data) {
    // Welcome message
    const welcome = document.querySelector('.dashboard-header p');
    const user = App.getUser();
    if (welcome && user) {
      welcome.textContent = `Xush kelibsiz, ${user.full_name?.split(' ')[0] || user.full_name}!`;
    }

    // Stats cards — '.stats-row .stat-info h3'
    const statCards = document.querySelectorAll('.stats-row .stat-info h3');
    if (statCards.length >= 4) {
      statCards[0].textContent = (data.total_students || 0).toLocaleString('uz-UZ');
      statCards[1].textContent = data.total_courses || 0;
      statCards[2].textContent = (data.average_rating || 0).toFixed(1);
      const lastMonth = data.monthly_earnings?.[data.monthly_earnings.length - 1];
      statCards[3].textContent = lastMonth ? Math.round(lastMonth.amount).toLocaleString('uz-UZ') : '0';
    }

    // Student list
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
};

document.addEventListener('DOMContentLoaded', () => TeacherDashboard.init());
