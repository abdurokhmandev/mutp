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
          <input type="checkbox" class="category-checkbox" value="${cat.slug}">
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
    const searchInput = document.getElementById('searchInput') || document.getElementById('sidebarSearch');
    const sortSelect = document.querySelector('.sort-select');

    if (!grid) return;

    // Skeletons view before real data is loaded
    const showSkeletons = (count = 8) => {
      grid.innerHTML = Array(count).fill(`
        <div class="course-skeleton skeleton">
          <div class="course-skeleton-thumb skeleton"></div>
          <div class="course-skeleton-body">
            <div class="skeleton-line" style="width:40%"></div>
            <div class="skeleton-line" style="width:90%"></div>
            <div class="skeleton-line" style="width:75%"></div>
            <div class="skeleton-line" style="width:50%"></div>
          </div>
        </div>
      `).join('');
    };

    const getFilterParams = () => {
      const params = new URLSearchParams();

      // Selected categories
      const cats = [...document.querySelectorAll('.category-checkbox:checked')]
        .map(cb => cb.value);
      if (cats.length) params.set('category', cats.join(','));

      // Level
      const level = document.querySelector('.level-radio:checked')?.value;
      if (level) params.set('level', level);

      // Free toggle
      const free = document.getElementById('freeOnly')?.checked;
      if (free) params.set('is_free', 'true');

      // Search query
      const search = searchInput?.value.trim();
      if (search) params.set('search', search);

      // Sort
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

      return params.toString();
    };

    const load = async () => {
      showSkeletons(6);

      const paramsStr = getFilterParams();
      try {
        const endpoint = paramsStr ? `/courses/?${paramsStr}` : '/courses/';
        const result = await API.get(endpoint);
        const data = result.data;
        const courses = data.results || data || [];

        if (!courses.length) {
          grid.innerHTML = '<p style="grid-column:1/-1;color:var(--muted);text-align:center;padding:40px 0;">Kurslar topilmadi.</p>';
          if (countEl) countEl.textContent = '0 ta kurs topildi';
          return;
        }

        grid.innerHTML = courses.map((c, i) => this.renderCourseCard(c, i)).join('');
        
        // Re-observe scroll reveal if animations exist
        if (window.sr && typeof window.sr.observe === 'function') {
          window.sr.observe('.course-card');
        }

        if (countEl) {
          const total = data.count ?? courses.length;
          countEl.textContent = `${total} ta kurs topildi`;
        }
      } catch (error) {
        grid.innerHTML = `<p style="grid-column:1/-1;color:var(--rose);text-align:center;padding:40px 0;">Xatolik: ${error.message}</p>`;
      }
    };

    // Load categories from API dynamically
    try {
      const categories = await this.loadCategories();
      const catGroup = document.querySelectorAll('.filter-group')[0];
      if (catGroup) this.renderCategories(categories, catGroup);
    } catch (e) {
      console.error("Kategoriyalarni yuklashda xatolik:", e);
    }

    // Attach event listeners dynamically to document for categories since they render asynchronously
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('category-checkbox')) {
        load();
      }
    });

    // Level radios event listeners
    document.querySelectorAll('.level-radio').forEach(r => {
      r.addEventListener('change', () => load());
    });

    // Free checkbox event listener
    const freeToggle = document.getElementById('freeOnly');
    if (freeToggle) {
      freeToggle.addEventListener('change', () => load());
    }

    // Search and Sort event listeners
    searchInput?.addEventListener('input', debounce(load, 400));
    sortSelect?.addEventListener('change', load);

    // Clear filters button helper
    const clearBtn = document.querySelector('.clear-filters');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (searchInput) searchInput.value = '';
        document.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = false);
        const allLevelRadio = document.querySelector('.level-radio[value=""]');
        if (allLevelRadio) allLevelRadio.checked = true;
        if (freeToggle) freeToggle.checked = false;
        load();
      });
    }

    await load();
  }
};

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

window.Courses = Courses;
