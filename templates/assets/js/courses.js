// courses.js — kurslar ro'yxatini API dan yuklash
const Courses = {
  thumbGradients: [
    'thumb-blue',
    'thumb-green',
    '',
    '',
  ],

  extraThumbStyles: [
    '',
    '',
    'background:linear-gradient(135deg,#FFFBEB,#FEF3C7)',
    'background:linear-gradient(135deg,#FAF5FF,#EDE9FE)',
  ],

  categoryEmojis: {
    Dasturlash: '💻',
    Tillar: '🗣️',
    Dizayn: '🎨',
    Biznes: '📊',
    Matematika: '🔢',
    Multimedia: '📸',
  },

  formatPrice(course) {
    if (course.is_free || Number(course.effective_price) === 0) {
      return { text: 'Bepul', className: 'free' };
    }
    const price = Number(course.effective_price || course.price);
    return {
      text: `${price.toLocaleString('uz-UZ')} so'm`,
      className: '',
    };
  },

  getInitials(name) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  },

  renderCourseCard(course, index = 0) {
    const price = this.formatPrice(course);
    const badgeClass = course.is_free ? 'badge-free' : 'badge-paid';
    const badgeText = course.is_free ? 'Bepul' : 'Premium';
    const rating = course.average_rating ? course.average_rating.toFixed(1) : '—';
    const students = course.student_count || 0;

    let thumbHtml = '';
    if (course.thumbnail) {
      thumbHtml = `<img src="${course.thumbnail}" alt="${course.title}" style="width:100%;height:100%;object-fit:cover;border-radius:16px 16px 0 0;">`;
    } else {
      // Clean modern gradient placeholder with course category name or MUTP
      thumbHtml = `<div style="width:100%;height:100%;background:linear-gradient(135deg, #10B981, #059669);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-family:'Plus Jakarta Sans';font-size:20px;">MUTP</div>`;
    }

    return `
      <a href="/course-detail.html?slug=${course.slug}" style="text-decoration:none;">
        <div class="course-card" style="border-radius:16px; overflow:hidden;">
          <div class="course-thumb" style="position:relative; height:160px; overflow:hidden; background:#f3f4f6; border-radius:16px 16px 0 0;">
            ${thumbHtml}
            <span class="course-badge-abs ${badgeClass}">${badgeText}</span>
          </div>
          <div class="course-body">
            <div class="course-cat">${course.category_name || 'Kurs'}</div>
            <div class="course-title">${course.title}</div>
            <div class="course-instructor">
              <span class="avatar-xs">${this.getInitials(course.teacher_name)}</span>
              ${course.teacher_name || "O'qituvchi"}
            </div>
            <div class="course-foot">
              <div class="rating">
                <span class="star">★</span> ${rating}
                <span style="color:var(--muted)">(${students})</span>
              </div>
              <div class="course-price ${price.className}">${price.text}</div>
            </div>
          </div>
        </div>
      </a>
    `;
  },

  async loadCourses(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/courses/?${query}` : '/courses/';
    const result = await API.get(endpoint);
    return result.data;
  },

  async loadCategories() {
    const result = await API.get('/courses/categories/');
    return result.data;
  },

  renderCategories(categories, container) {
    if (!container) return;
    const title = container.querySelector('.filter-group-title');
    const items = categories
      .map(
        (cat) => `
        <label class="filter-item">
          <input type="checkbox" data-category="${cat.slug}">
          ${cat.icon || '📁'} ${cat.name} (${cat.courses_count || 0})
        </label>
      `,
      )
      .join('');
    container.innerHTML = title ? title.outerHTML + items : items;
  },

  async initCatalogPage() {
    const grid = document.querySelector('.courses-grid');
    const countEl = document.querySelector('.results-count');
    const searchInput = document.getElementById('sidebarSearch');
    const sortSelect = document.querySelector('.sort-select');
    const categoryContainer = document.querySelector('.filter-group .filter-group-title + .filter-item')
      ? document.querySelector('.filter-group')
      : null;

    if (!grid) return;

    const load = async () => {
      grid.innerHTML = '<p style="grid-column:1/-1;color:var(--muted);">Yuklanmoqda...</p>';

      const params = {};
      if (searchInput?.value.trim()) {
        params.search = searchInput.value.trim();
      }

      const sortMap = {
        "Eng mashhur": 'popular',
        "Yangi qo'shilganlar": 'newest',
        'Eng yuqori baho': 'rating',
        'Arzon → Qimmat': 'price_low',
        'Qimmat → Arzon': 'price_high',
      };
      if (sortSelect) {
        params.sort = sortMap[sortSelect.value] || 'newest';
      }

      try {
        const data = await this.loadCourses(params);
        const courses = data.results || data;

        if (!courses.length) {
          grid.innerHTML = '<p style="grid-column:1/-1;color:var(--muted);">Kurslar topilmadi.</p>';
          if (countEl) countEl.textContent = '0 ta kurs topildi';
          return;
        }

        grid.innerHTML = courses.map((c, i) => this.renderCourseCard(c, i)).join('');
        if (countEl) {
          const total = data.count ?? courses.length;
          countEl.textContent = `${total} ta kurs topildi`;
        }
      } catch (error) {
        grid.innerHTML = `<p style="grid-column:1/-1;color:var(--rose);">Xatolik: ${error.message}</p>`;
      }
    };

    try {
      const categories = await this.loadCategories();
      const catGroup = document.querySelectorAll('.filter-group')[0];
      if (catGroup) this.renderCategories(categories, catGroup);
    } catch {
      // Kategoriyalar yuklanmasa, statik filter qoladi
    }

    searchInput?.addEventListener('input', debounce(load, 400));
    sortSelect?.addEventListener('change', load);
    await load();
  },
};

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

window.Courses = Courses;
