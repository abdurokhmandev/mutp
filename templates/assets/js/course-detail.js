// course-detail.js — premium va to'liq dinamik kurs tafsilotlari
const CourseDetail = {
  course: null,

  getSlug() {
    return new URLSearchParams(window.location.search).get('slug');
  },

  formatDuration(seconds) {
    return App.formatDuration(seconds);
  },

  formatPrice(course) {
    return App.formatPrice(course);
  },

  async load(slug) {
    const result = await API.get(`/courses/${slug}/`);
    return result.data;
  },

  async enroll() {
    if (!App.isLoggedIn()) {
      window.location.href = '/auth.html';
      return;
    }
    try {
      await API.post(`/courses/${this.course.slug}/enroll/`);
      window.toast?.show("Kursga muvaffaqiyatli yozildingiz!", 'success');
      this.course.is_enrolled = true;
      this.updateCta();
      
      const first = this.getFirstLesson();
      if (first) {
        setTimeout(() => {
          window.location.href = `/lesson.html?id=${first.id}&slug=${this.course.slug}`;
        }, 800);
      } else {
        window.toast?.show("Kursga yozildingiz! Hozircha darslar mavjud emas.", 'info');
      }
    } catch (e) {
      if (e.message?.includes('allaqachon')) {
        this.course.is_enrolled = true;
        this.updateCta();
        const first = this.getFirstLesson();
        if (first) {
          window.location.href = `/lesson.html?id=${first.id}&slug=${this.course.slug}`;
        } else {
          window.toast?.show("Siz allaqachon yozilgansiz. Hozircha darslar mavjud emas.", 'info');
        }
        return;
      }
      window.toast?.show(e.message, 'error');
    }
  },

  updateCta() {
    const startBtn = document.getElementById('enrollBtn');
    const firstLesson = this.getFirstLesson();
    const lessonUrl = firstLesson
      ? `/lesson.html?id=${firstLesson.id}&slug=${this.course.slug}`
      : '#';

    if (startBtn) {
      if (this.course.is_enrolled) {
        startBtn.textContent = 'Davom etish';
        startBtn.href = lessonUrl;
        startBtn.onclick = null;
        startBtn.style.opacity = '1';
      } else {
        // Hamma kurslar uchun yozilish (MVP demo)
        startBtn.textContent = this.course.is_free ? 'Kursni boshlash' : 'Kursni boshlash (Demo Bepul)';
        startBtn.href = '#';
        startBtn.onclick = (e) => { e.preventDefault(); this.enroll(); };
        startBtn.style.opacity = '1';
      }
    }
  },

  getFirstLesson() {
    for (const mod of this.course.modules || []) {
      if (mod.lessons?.length) return mod.lessons[0];
    }
    return null;
  },

  async init() {
    const slug = this.getSlug();
    if (!slug) {
      window.toast?.show('Kurs topilmadi', 'error');
      return;
    }

    try {
      this.course = await this.load(slug);
      document.title = `${this.course.title} | MUTP`;

      const titleEl = document.querySelector('.course-title-lg');
      const descEl = document.querySelector('.course-desc');
      const priceEl = document.querySelector('.price-tag');
      const breadcrumb = document.querySelector('.breadcrumb');

      if (titleEl) titleEl.textContent = this.course.title;
      if (descEl) descEl.textContent = this.course.description || '';
      if (breadcrumb) {
        breadcrumb.innerHTML = `<a href="/index.html">Bosh sahifa</a> &rsaquo; <a href="/courses.html">${this.course.category_name || 'Kurslar'}</a> &rsaquo; ${this.course.title}`;
      }

      const price = this.formatPrice(this.course);
      if (priceEl) {
        priceEl.textContent = price.text;
        priceEl.className = `price-tag ${price.className}`.trim();
      }

      const metaEl = document.querySelector('.hero-meta');
      if (metaEl) {
        metaEl.innerHTML = `
          <div class="rating"><i class="ti ti-star-filled"></i> ${(this.course.average_rating || 0).toFixed(1)} <span style="color:var(--blue-mid);font-weight:400;margin-left:4px">(${this.course.student_count} o'quvchi)</span></div>
          <div><i class="ti ti-clock"></i> ${this.formatDuration(this.course.total_duration_seconds)}</div>
          <div><i class="ti ti-chart-bar"></i> ${App.levelLabel(this.course.level)}</div>
          <div><i class="ti ti-language"></i> ${App.languageLabel(this.course.language)}</div>
          <div><i class="ti ti-video"></i> ${this.course.lessons_count} dars</div>
        `;
      }

      const instructorRow = document.querySelector('.instructor-row');
      if (instructorRow) {
        instructorRow.innerHTML = `
          <div class="avatar-md">${App.initials(this.course.teacher_name)}</div>
          <div>
            <div style="font-weight:600;">${this.course.teacher_name}</div>
            <div style="font-size:12px;color:var(--blue-mid)">O'qituvchi</div>
          </div>
        `;
      }

      const includesList = document.querySelector('.includes-list');
      if (includesList) {
        includesList.innerHTML = `
          <li><i class="ti ti-device-desktop"></i> ${this.formatDuration(this.course.total_duration_seconds)} video darslar</li>
          <li><i class="ti ti-list"></i> ${this.course.modules?.length || 0} bo'lim</li>
          <li><i class="ti ti-video"></i> ${this.course.lessons_count} ta dars</li>
          <li><i class="ti ti-infinity"></i> Doimiy dostup</li>
          <li><i class="ti ti-certificate"></i> Kurs yakunida sertifikat</li>
        `;
      }

      // 1. Nima o'rganasiz block rendering
      const outcomesBlock = document.getElementById('learningOutcomesBlock');
      const outcomesGrid = document.getElementById('learningOutcomesGrid');
      if (outcomesBlock && outcomesGrid) {
        if (this.course.learning_outcomes && this.course.learning_outcomes.length > 0) {
          outcomesGrid.innerHTML = this.course.learning_outcomes.map(item => `
            <div class="learn-item"><i class="ti ti-check"></i> ${item}</div>
          `).join('');
          outcomesBlock.style.display = 'block';
        } else {
          outcomesBlock.style.display = 'none';
        }
      }

      this.renderModules();
      this.updateCta();

      // 2. Preview Video / Thumbnail rendering
      const preview = document.getElementById('previewVideoContainer');
      if (preview) {
        let previewUrl = this.course.preview_video_url;
        let isFreeLessonPreview = false;
        let fallbackLessonId = null;

        if (!previewUrl) {
          // find first free preview lesson with a video link
          for (const mod of this.course.modules || []) {
            for (const les of mod.lessons || []) {
              if (les.is_free_preview && (les.video_file || les.video_url)) {
                previewUrl = les.video_file || les.video_url;
                isFreeLessonPreview = true;
                fallbackLessonId = les.id;
                break;
              }
            }
            if (previewUrl) break;
          }
        }

        // Set cover background
        if (this.course.thumbnail) {
          preview.style.backgroundImage = `url(${this.course.thumbnail})`;
          preview.style.backgroundSize = 'cover';
          preview.style.backgroundPosition = 'center';
        } else {
          preview.style.background = 'linear-gradient(135deg, var(--duo-green), var(--duo-green-dark))';
        }

        const firstLesson = this.getFirstLesson();
        preview.onclick = () => {
          if (this.course.is_enrolled && firstLesson) {
            // enrolled -> go straight to first lesson
            window.location.href = `/lesson.html?id=${firstLesson.id}&slug=${this.course.slug}`;
          } else if (previewUrl) {
            if (isFreeLessonPreview && fallbackLessonId) {
              window.location.href = `/lesson.html?id=${fallbackLessonId}&slug=${this.course.slug}`;
            } else {
              window.open(previewUrl, '_blank');
            }
          } else {
            // no preview url, enroll first
            this.enroll();
          }
        };
      }

    } catch (error) {
      window.toast?.show(error.message, 'error');
    }
  },

  renderModules() {
    const container = document.querySelector('.accordion');
    if (!container || !this.course.modules?.length) return;

    container.innerHTML = this.course.modules.map((mod, i) => `
      <div class="acc-item ${i === 0 ? 'active' : ''}">
        <div class="acc-header" onclick="this.parentElement.classList.toggle('active')">
          <span>${mod.title}</span>
          <div class="acc-meta">
            <span>${mod.lessons_count} dars</span>
            <i class="ti ti-chevron-down"></i>
          </div>
        </div>
        <div class="acc-content">
          ${(mod.lessons || []).map((lesson) => `
            <div class="lesson-item">
              <div class="lesson-name">
                <i class="ti ti-${lesson.is_free_preview ? 'player-play' : 'lock'}"></i>
                ${lesson.title}
              </div>
              <a href="/lesson.html?id=${lesson.id}&slug=${this.course.slug}">${lesson.duration_display || "Ko'rish"}</a>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  },
};

window.CourseDetail = CourseDetail;
