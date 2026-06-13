// create-course.js — kurs yaratish va darslar qo'shish
const CreateCourse = {
  course: null,
  thumbFile: null,
  categories: [],

  async init() {
    if (!App.requireAuth(['teacher'])) return;

    const slug = new URLSearchParams(window.location.search).get('slug');
    await this.loadCategories();

    if (slug) {
      try {
        const res = await API.get(`/courses/teacher/courses/${slug}/`);
        this.course = res.data;
        this.fillStep1();
        await this.renderModules();
      } catch (e) {
        window.toast?.show(e.message, 'error');
      }
    }

    this.bindEvents();
    this.updatePreview();
    this.updateChecklist();
  },

  async loadCategories() {
    const res = await API.get('/courses/categories/');
    this.categories = res.data || [];
    const select = document.getElementById('categorySelect');
    if (select) {
      select.innerHTML = this.categories.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  },

  bindEvents() {
    document.getElementById('thumbInput')?.addEventListener('change', (e) => {
      this.thumbFile = e.target.files[0];
      if (this.thumbFile) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const thumb = document.querySelector('.cp-thumb');
          if (thumb) thumb.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover">`;
        };
        reader.readAsDataURL(this.thumbFile);
      }
      this.updateChecklist();
    });

    document.getElementById('courseTitle')?.addEventListener('input', () => this.updatePreview());
    document.getElementById('coursePrice')?.addEventListener('input', () => this.updatePreview());
    document.getElementById('freeSwitch')?.addEventListener('change', () => this.updatePreview());

    document.getElementById('btnAddModule')?.addEventListener('click', () => this.addModule());
    document.getElementById('btnSaveDraft')?.addEventListener('click', () => this.saveStep1(true));
    document.getElementById('btnStep1Next')?.addEventListener('click', () => this.saveStep1(false));
    document.getElementById('btnPublish')?.addEventListener('click', () => this.publish());

    document.getElementById('btnAddOutcome')?.addEventListener('click', () => {
      const container = document.getElementById('learningOutcomesContainer');
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.gap = '8px';
      div.innerHTML = `
        <input type="text" class="form-control outcome-input" placeholder="Masalan: Yangi o'rganiladigan narsa">
        <button type="button" class="btn-secondary" style="padding:10px; border:none;" onclick="if(document.querySelectorAll('.outcome-input').length > 1) this.parentElement.remove()"><i class="ti ti-trash"></i></button>
      `;
      container.appendChild(div);
    });
  },

  getStep1Data() {
    const levelMap = { "Boshlang'ich": 'beginner', "O'rta": 'intermediate', 'Yuqori': 'advanced' };
    const langMap = { "O'zbekcha": 'uz', 'Ruscha': 'ru', 'Inglizcha': 'en' };
    const activeLevel = document.querySelector('.radio-card.active')?.textContent?.trim();
    const lang = document.getElementById('languageSelect')?.value;
    const isFree = document.getElementById('freeSwitch')?.checked;

    const outcomes = [];
    document.querySelectorAll('.outcome-input').forEach(input => {
      const val = input.value.trim();
      if (val) outcomes.push(val);
    });

    return {
      title: document.getElementById('courseTitle')?.value?.trim(),
      description: document.getElementById('courseDesc')?.value?.trim() || '',
      category_id: document.getElementById('categorySelect')?.value,
      level: levelMap[activeLevel] || 'beginner',
      language: langMap[lang] || lang || 'uz',
      price: isFree ? 0 : (document.getElementById('coursePrice')?.value || 0),
      preview_video_url: document.getElementById('coursePreviewVideo')?.value?.trim() || null,
      learning_outcomes: outcomes
    };
  },

  fillStep1() {
    if (!this.course) return;
    document.getElementById('courseTitle').value = this.course.title;
    document.getElementById('courseDesc').value = this.course.description || '';
    if (this.course.category_name) {
      const cat = this.categories.find((c) => c.name === this.course.category_name);
      if (cat) document.getElementById('categorySelect').value = cat.id;
    }
    document.getElementById('freeSwitch').checked = this.course.is_free;
    togglePrice();
    if (!this.course.is_free) {
      document.getElementById('coursePrice').value = this.course.price;
    }
    if (this.course.thumbnail) {
      document.querySelector('.cp-thumb').innerHTML = `<img src="${this.course.thumbnail}" style="width:100%;height:100%;object-fit:cover">`;
    }
    if (this.course.preview_video_url) {
      document.getElementById('coursePreviewVideo').value = this.course.preview_video_url;
    }
    if (this.course.learning_outcomes && this.course.learning_outcomes.length > 0) {
      const container = document.getElementById('learningOutcomesContainer');
      if (container) {
        container.innerHTML = this.course.learning_outcomes.map((item) => `
          <div style="display:flex; gap:8px;">
            <input type="text" class="form-control outcome-input" value="${item}" placeholder="Masalan: Yangi o'rganiladigan narsa">
            <button type="button" class="btn-secondary" style="padding:10px; border:none;" onclick="if(document.querySelectorAll('.outcome-input').length > 1) this.parentElement.remove()"><i class="ti ti-trash"></i></button>
          </div>
        `).join('');
      }
    }
    this.updatePreview();
  },

  async saveStep1(draftOnly = false) {
    const data = this.getStep1Data();
    if (!data.title) {
      window.toast?.show('Kurs nomini kiriting', 'error');
      return;
    }

    try {
      if (!this.course) {
        const res = await API.post('/courses/teacher/courses/create/', data);
        this.course = res.data;
        window.toast?.show('Kurs yaratildi', 'success');
      } else {
        const res = await API.patch(`/courses/teacher/courses/${this.course.slug}/update/`, data);
        this.course = res.data;
        window.toast?.show('Saqlandi', 'success');
      }

      if (this.thumbFile) {
        const fd = new FormData();
        fd.append('thumbnail', this.thumbFile);
        const res = await API.patch(`/courses/teacher/courses/${this.course.slug}/update/`, fd);
        this.course = res.data;
        this.thumbFile = null;
      }

      this.updateChecklist();
      if (!draftOnly) nextStep(2);
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  async addModule() {
    if (!this.course) {
      window.toast?.show('Avval 1-qadamni saqlang', 'error');
      return;
    }
    const title = prompt("Bo'lim nomini kiriting:");
    if (!title?.trim()) return;

    try {
      await API.post(`/courses/teacher/courses/${this.course.slug}/modules/`, { title: title.trim() });
      await this.refreshCourse();
      window.toast?.show("Bo'lim qo'shildi", 'success');
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  async refreshCourse() {
    const res = await API.get(`/courses/teacher/courses/${this.course.slug}/`);
    this.course = res.data;
    await this.renderModules();
    this.updateChecklist();
  },

  async renderModules() {
    const container = document.getElementById('modulesContainer');
    if (!container || !this.course) return;

    const modules = this.course.modules || [];
    if (!modules.length) {
      container.innerHTML = '<p style="color:var(--muted);font-size:14px">Hali bo\'limlar yo\'q. "Bo\'lim qo\'shish" tugmasini bosing.</p>';
      return;
    }

    container.innerHTML = modules.map((mod) => `
      <div class="section-card" data-module-id="${mod.id}">
        <div class="section-header">
          <strong>${mod.title}</strong>
          <span style="font-size:12px;color:var(--muted)">${mod.lessons_count || 0} dars</span>
        </div>
        <div class="section-lessons">
          ${(mod.lessons || []).map((l) => `
            <div class="lesson-item">
              <i class="ti ti-video" style="color:var(--blue)"></i>
              <span style="flex:1">${l.title}</span>
              <span style="font-size:12px;color:var(--muted)">${l.duration_display || ''}</span>
            </div>
          `).join('')}
          <div style="padding:12px 16px;background:var(--surface)">
            <button class="btn-secondary btn-add-lesson" data-module-id="${mod.id}" style="font-size:13px;width:100%;border-style:dashed">
              <i class="ti ti-plus"></i> Dars qo'shish
            </button>
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-add-lesson').forEach((btn) => {
      btn.addEventListener('click', () => this.addLesson(btn.dataset.moduleId));
    });
  },

  async addLesson(moduleId) {
    const title = prompt('Dars nomini kiriting:');
    if (!title?.trim()) return;

    const withVideo = confirm("Video fayl yuklaysizmi?\n\nOK = video tanlash\nBekor = matn dars (videosiz)");

    if (!withVideo) {
      try {
        await API.post(`/courses/teacher/modules/${moduleId}/lessons/`, {
          title: title.trim(),
          lesson_type: 'text',
          content: '',
        });
        await this.refreshCourse();
        window.toast?.show("Dars qo'shildi", 'success');
      } catch (e) {
        window.toast?.show(e.message, 'error');
      }
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/webm,video/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        window.toast?.show('Video fayl tanlanmadi', 'error');
        return;
      }

      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('lesson_type', 'video');
      fd.append('video_file', file);
      const duration = await this.getVideoDuration(file);
      if (duration) fd.append('duration_seconds', String(Math.round(duration)));

      try {
        await API.post(`/courses/teacher/modules/${moduleId}/lessons/`, fd);
        await this.refreshCourse();
        window.toast?.show("Video dars qo'shildi", 'success');
      } catch (e) {
        window.toast?.show(e.message, 'error');
      }
    };
    input.click();
  },

  getVideoDuration(file) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => resolve(0);
      video.src = URL.createObjectURL(file);
    });
  },

  async publish() {
    if (!this.course) {
      window.toast?.show('Avval kursni saqlang', 'error');
      return;
    }
    try {
      await API.post(`/courses/teacher/courses/${this.course.slug}/publish/`);
      window.toast?.show('Kurs nashr etildi!', 'success');
      setTimeout(() => { window.location.href = '/dashboard-teacher.html'; }, 1500);
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  updatePreview() {
    const title = document.getElementById('courseTitle')?.value || 'Kurs nomi...';
    const isFree = document.getElementById('freeSwitch')?.checked;
    const price = document.getElementById('coursePrice')?.value;
    const catSelect = document.getElementById('categorySelect');
    const catName = catSelect?.options[catSelect.selectedIndex]?.text || 'KATEGORIYA';

    const previewTitle = document.querySelector('.course-preview-card div[style*="font-weight:600"]');
    const previewCat = document.querySelector('.course-preview-card div[style*="font-weight:700"]');
    const previewPrice = document.querySelector('.course-preview-card div[style*="font-weight:700;color"]');

    if (previewTitle) previewTitle.textContent = title;
    if (previewCat) previewCat.textContent = catName.toUpperCase();
    if (previewPrice) {
      previewPrice.textContent = isFree ? 'Bepul' : `${Number(price || 0).toLocaleString('uz-UZ')} so'm`;
      previewPrice.style.color = isFree ? 'var(--green)' : 'var(--ink)';
    }
  },

  updateChecklist() {
    const hasTitle = !!document.getElementById('courseTitle')?.value?.trim();
    const hasThumb = !!(this.thumbFile || this.course?.thumbnail);
    const lessonCount = (this.course?.modules || []).reduce((s, m) => s + (m.lessons?.length || m.lessons_count || 0), 0);
    const hasLessons = lessonCount > 0;

    const items = document.querySelectorAll('.checklist li');
    if (items.length >= 4) {
      items[0].innerHTML = `<i class="ti ti-${hasTitle ? 'check' : 'x'}"></i> Asosiy ma'lumotlar`;
      items[1].innerHTML = `<i class="ti ti-check"></i> Narx belgilangan`;
      items[2].innerHTML = `<i class="ti ti-${hasThumb ? 'check' : 'x'}"></i> Rasm yuklangan`;
      items[3].innerHTML = `<i class="ti ti-${hasLessons ? 'check' : 'x'}"></i> Kamida 1 ta dars kerak`;
    }

    const pubBtn = document.getElementById('btnPublish');
    if (pubBtn) {
      const ready = hasTitle && hasLessons;
      pubBtn.disabled = !ready;
      pubBtn.style.opacity = ready ? '1' : '0.5';
      pubBtn.style.cursor = ready ? 'pointer' : 'not-allowed';
    }
  },
};

document.addEventListener('DOMContentLoaded', () => CreateCourse.init());
