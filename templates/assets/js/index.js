// index.js — bosh sahifada real kurslar
const IndexPage = {
  allCourses: [],

  async loadCourses() {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;

    grid.innerHTML = '<p style="color:var(--muted);padding:20px">Kurslar yuklanmoqda...</p>';

    try {
      const result = await API.get('/courses/?sort=popular&page_size=12');
      this.allCourses = result.data.results || result.data || [];

      if (!this.allCourses.length) {
        grid.innerHTML = '<p style="color:var(--muted);padding:20px">Hozircha kurslar yo\'q. Tez orada qo\'shiladi.</p>';
        return;
      }

      this.renderCourses(this.allCourses);
      this.updateStats();
    } catch (e) {
      grid.innerHTML = `<p style="color:var(--rose);padding:20px">${e.message}</p>`;
    }
  },

  renderCourses(courses) {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;

    const catSlugMap = {
      dasturlash: 'dasturlash',
      tillar: 'tillar',
      dizayn: 'dizayn',
      biznes: 'biznes',
      math: 'matematika',
      matematika: 'matematika',
    };

    grid.innerHTML = courses.map((c, i) => {
      const card = Courses.renderCourseCard(c, i);
      const catKey = (c.category_name || '').toLowerCase();
      const dataCat = Object.keys(catSlugMap).find((k) => catKey.includes(k)) || 'all';
      return card.replace('<div class="course-card">', `<div class="course-card" data-cat="${dataCat}" data-title="${c.title.toLowerCase()}">`);
    }).join('');
  },

  updateStats() {
    const count = this.allCourses.length;
    const students = this.allCourses.reduce((s, c) => s + (c.student_count || 0), 0);
    const statEls = document.querySelectorAll('.hero-stats [data-count]');
    if (statEls.length >= 2) {
      statEls[1].setAttribute('data-count', String(count));
      if (statEls[0]) statEls[0].setAttribute('data-count', String(Math.max(students, count * 10)));
    }
  },

  bindFilters() {
    const chips = document.querySelectorAll('.filter-chip');
    const searchInput = document.getElementById('courseSearch');

    const filter = () => {
      const active = document.querySelector('.filter-chip.active')?.dataset.cat || 'all';
      const q = (searchInput?.value || '').toLowerCase().trim();

      let filtered = this.allCourses;
      if (active !== 'all') {
        filtered = filtered.filter((c) => {
          const name = (c.category_name || '').toLowerCase();
          return name.includes(active) || (active === 'math' && name.includes('matemat'));
        });
      }
      if (q) {
        filtered = filtered.filter((c) => c.title.toLowerCase().includes(q));
      }
      this.renderCourses(filtered);
    };

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        filter();
      });
    });

    searchInput?.addEventListener('input', filter);
  },

  async loadTeachers() {
    const grid = document.querySelector('.teachers-grid');
    if (!grid) return;

    try {
      const result = await API.get('/auth/teachers/');
      const teachers = result.data || [];
      if (!teachers.length) return;

      const colors = [
        { bg: '#DBEAFE', color: '#1D4ED8' },
        { bg: '#D1FAE5', color: '#065F46' },
        { bg: '#EDE9FE', color: '#5B21B6' },
        { bg: '#FFE4E6', color: '#9F1239' }
      ];

      grid.innerHTML = teachers.slice(0, 4).map((t, idx) => {
        const u = t.user_details || {};
        const col = colors[idx % colors.length];
        return `
          <div class="teacher-mini-card">
            <div class="teacher-avatar-lg" style="background:${col.bg};color:${col.color}">${App.initials(u.full_name)}</div>
            <div class="teacher-mini-name">${u.full_name}</div>
            <div class="teacher-mini-role">${t.specialization || "O'qituvchi"}</div>
            <div class="teacher-mini-stats">
              <div class="tms"><span class="tms-num">${t.total_students || 0}</span><span class="tms-label">O'quvchi</span></div>
              <div class="tms"><span class="tms-num">${(t.average_rating || 0).toFixed(1)}★</span><span class="tms-label">Reyting</span></div>
              <div class="tms"><span class="tms-num">${t.courses_count || 0}</span><span class="tms-label">Kurs</span></div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.error("O'qituvchilarni yuklashda xatolik:", e);
    }
  },

  async init() {
    this.bindFilters();
    await Promise.all([this.loadCourses(), this.loadTeachers()]);
  },
};

document.addEventListener('DOMContentLoaded', () => IndexPage.init());
