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
            <div class="lesson-item" style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:12px; flex:1;">
                <i class="ti ti-${l.lesson_type === 'quiz' ? 'help' : l.lesson_type === 'text' ? 'book' : 'video'}" style="color:var(--duo-green)"></i>
                <span style="font-weight:600">${l.title}</span>
                <span style="font-size:11px; color:var(--muted)">(${l.lesson_type === 'video' ? 'Video' : l.lesson_type === 'text' ? 'Matn' : 'Test'})</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:12px;color:var(--muted)">${l.duration_display || ''}</span>
                <button type="button" class="btn-secondary btn-edit-lesson" data-module-id="${mod.id}" data-lesson-id="${l.id}" style="padding:4px 8px; border:none; cursor:pointer;"><i class="ti ti-edit"></i></button>
              </div>
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
      btn.addEventListener('click', () => this.openLessonModal(btn.dataset.moduleId));
    });

    container.querySelectorAll('.btn-edit-lesson').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openLessonModal(btn.dataset.moduleId, btn.dataset.lessonId);
      });
    });
  },

  currentModuleId: null,
  currentLessonId: null,
  quizQuestions: [],
  lessonResources: [],

  openLessonModal(moduleId, lessonId = null) {
    this.currentModuleId = moduleId;
    this.currentLessonId = lessonId;
    this.quizQuestions = [];
    this.lessonResources = [];

    // Reset fields
    document.getElementById('lessonForm').reset();
    document.getElementById('modalTitle').textContent = lessonId ? 'Darsni tahrirlash' : 'Yangi dars qo\'shish';
    document.getElementById('resourceList').innerHTML = '';
    document.getElementById('questionsList').innerHTML = '';

    // Bind UI change handlers
    this.initLessonModalEvents();

    if (lessonId) {
      this.loadLessonData(lessonId);
    } else {
      this.toggleLessonTypeFields();
      document.getElementById('lessonModal').style.display = 'flex';
    }
  },

  async loadLessonData(lessonId) {
    try {
      const res = await API.get(`/courses/lessons/${lessonId}/`);
      const l = res.data;
      document.getElementById('lessonTitle').value = l.title || '';
      document.getElementById('lessonType').value = l.lesson_type || 'video';
      document.getElementById('lessonContent').value = l.content || '';
      
      if (l.video_url && (l.video_url.includes('youtube.com') || l.video_url.includes('youtu.be'))) {
        document.getElementById('videoSource').value = 'url';
        document.getElementById('lessonVideoUrl').value = l.video_url;
      } else {
        document.getElementById('videoSource').value = 'file';
      }

      this.lessonResources = l.resources || [];
      this.renderResourceList();

      this.quizQuestions = l.questions || [];
      this.renderQuestionsBuilder();

      this.toggleLessonTypeFields();
      document.getElementById('lessonModal').style.display = 'flex';
    } catch (err) {
      window.toast?.show('Dars ma\'lumotlarini yuklashda xatolik: ' + err.message, 'error');
    }
  },

  closeLessonModal() {
    document.getElementById('lessonModal').style.display = 'none';
  },

  toggleLessonTypeFields() {
    const type = document.getElementById('lessonType').value;
    const source = document.getElementById('videoSource').value;

    document.getElementById('videoSourceGroup').style.display = type === 'video' ? 'block' : 'none';
    document.getElementById('videoUrlGroup').style.display = (type === 'video' && source === 'url') ? 'block' : 'none';
    document.getElementById('videoFileGroup').style.display = (type === 'video' && source === 'file') ? 'block' : 'none';
    document.getElementById('textContentGroup').style.display = type === 'text' ? 'block' : 'none';
    
    // Show/Hide Builders
    document.querySelector('.resource-builder').style.display = this.currentLessonId ? 'block' : 'none';
    document.querySelector('.homework-builder').style.display = (type === 'quiz' || (type === 'video' && this.currentLessonId)) ? 'block' : 'none';
  },

  initLessonModalEvents() {
    // Setup change triggers
    document.getElementById('lessonType').onchange = () => this.toggleLessonTypeFields();
    document.getElementById('videoSource').onchange = () => this.toggleLessonTypeFields();
    
    document.getElementById('resourceType').onchange = (e) => {
      const isFile = e.target.value === 'file';
      document.getElementById('resourceFile').style.display = isFile ? 'block' : 'none';
      document.getElementById('resourceUrl').style.display = isFile ? 'none' : 'block';
    };

    // Add Resource Click
    document.getElementById('addResourceBtn').onclick = async () => {
      if (!this.currentLessonId) {
        window.toast?.show("Avval darsning asosiy ma'lumotlarini saqlab oling!", 'warning');
        return;
      }

      const rType = document.getElementById('resourceType').value;
      const rTitle = document.getElementById('resourceTitle').value.trim();
      
      if (!rTitle) {
        window.toast?.show("Resurs nomini kiriting!", 'error');
        return;
      }

      const fd = new FormData();
      fd.append('title', rTitle);
      fd.append('resource_type', rType);

      if (rType === 'file') {
        const fileInput = document.getElementById('resourceFile');
        const file = fileInput.files[0];
        if (!file) {
          window.toast?.show("Fayl tanlang!", 'error');
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          window.toast?.show("Fayl hajmi 10 MB dan oshmasligi kerak!", 'error');
          return;
        }
        fd.append('file', file);
      } else {
        const url = document.getElementById('resourceUrl').value.trim();
        if (!url) {
          window.toast?.show("Havolani kiriting!", 'error');
          return;
        }
        fd.append('url', url);
      }

      try {
        window.toast?.show("Yuklanmoqda...", "info");
        const res = await API.post(`/courses/lessons/${this.currentLessonId}/resources/`, fd);
        window.toast?.show("Resurs muvaffaqiyatli qo'shildi!", "success");
        
        // Reload resources
        this.lessonResources.push(res.data);
        this.renderResourceList();

        // Clear fields
        document.getElementById('resourceTitle').value = '';
        document.getElementById('resourceFile').value = '';
        document.getElementById('resourceUrl').value = '';
      } catch (err) {
        window.toast?.show(err.message, 'error');
      }
    };

    // Add Question Click
    document.getElementById('addQuestionBtn').onclick = () => {
      this.quizQuestions.push({
        text: '',
        options: [
          { text: '', is_correct: true },
          { text: '', is_correct: false }
        ]
      });
      this.renderQuestionsBuilder();
    };

    // Save Form
    document.getElementById('lessonForm').onsubmit = async (e) => {
      e.preventDefault();
      const lTitle = document.getElementById('lessonTitle').value.trim();
      const lType = document.getElementById('lessonType').value;
      const content = document.getElementById('lessonContent').value.trim();
      
      if (!lTitle) {
        window.toast?.show("Dars nomini kiriting!", 'error');
        return;
      }

      const fd = new FormData();
      fd.append('title', lTitle);
      fd.append('lesson_type', lType);
      fd.append('content', content);

      if (lType === 'video') {
        const vSource = document.getElementById('videoSource').value;
        if (vSource === 'url') {
          const vUrl = document.getElementById('lessonVideoUrl').value.trim();
          if (!vUrl) {
            window.toast?.show("YouTube havolasini kiriting!", 'error');
            return;
          }
          fd.append('video_url', vUrl);
        } else {
          const vFile = document.getElementById('lessonVideoFile').files[0];
          if (vFile) {
            fd.append('video_file', vFile);
            const dur = await this.getVideoDuration(vFile);
            if (dur) fd.append('duration_seconds', String(Math.round(dur)));
          }
        }
      }

      try {
        let savedLesson = null;
        if (this.currentLessonId) {
          const res = await API.patch(`/courses/lessons/${this.currentLessonId}/update/`, fd);
          savedLesson = res.data;
        } else {
          const res = await API.post(`/courses/teacher/modules/${this.currentModuleId}/lessons/`, fd);
          savedLesson = res.data;
          this.currentLessonId = savedLesson.id;
        }

        // Savollarni saqlash
        if (lType === 'quiz' || (lType === 'video' && this.quizQuestions.length > 0)) {
          const validatedQuestions = this.collectQuizData();
          if (validatedQuestions) {
            await API.post(`/courses/lessons/${this.currentLessonId}/quiz/`, { questions: validatedQuestions });
          } else {
            return;
          }
        }

        window.toast?.show("Dars saqlandi!", 'success');
        this.closeLessonModal();
        await this.refreshCourse();
      } catch (err) {
        window.toast?.show(err.message, 'error');
      }
    };
  },

  renderResourceList() {
    const container = document.getElementById('resourceList');
    if (!container) return;

    if (this.lessonResources.length === 0) {
      container.innerHTML = '<p class="empty-state" style="padding: 8px;">Resurslar yo\'q.</p>';
      return;
    }

    container.innerHTML = this.lessonResources.map(r => `
      <div class="resource-builder-item">
        <span class="title">${r.title} (${r.resource_type === 'link' ? 'Havola' : 'Fayl'})</span>
        <button type="button" class="remove-btn" onclick="CreateCourse.deleteResource(${r.id})">✕</button>
      </div>
    `).join('');
  },

  async deleteResource(id) {
    if (!confirm("Haqiqatan ham ushbu resursni o'chirmoqchimisiz?")) return;
    try {
      await API.delete(`/courses/lessons/resources/${id}/`);
      window.toast?.show("Resurs o'chirildi", 'success');
      this.lessonResources = this.lessonResources.filter(r => r.id !== id);
      this.renderResourceList();
    } catch (err) {
      window.toast?.show(err.message, 'error');
    }
  },

  renderQuestionsBuilder() {
    const container = document.getElementById('questionsList');
    if (!container) return;

    if (this.quizQuestions.length === 0) {
      container.innerHTML = '<p class="empty-state" style="padding: 12px;">Hali savollar qo\'shilmagan.</p>';
      return;
    }

    container.innerHTML = '';
    this.quizQuestions.forEach((q, qIdx) => {
      const qBlock = document.createElement('div');
      qBlock.className = 'question-block';
      qBlock.dataset.index = qIdx;
      
      qBlock.innerHTML = `
        <div class="question-header">
          <span>Savol #${qIdx + 1}</span>
          <button type="button" class="remove-question-btn" onclick="CreateCourse.removeQuestion(${qIdx})">✕</button>
        </div>
        <input type="text" class="form-control question-text" placeholder="Savol matnini kiriting..." value="${q.text || ''}" style="margin-bottom:12px;" oninput="CreateCourse.quizQuestions[${qIdx}].text = this.value">
        <div class="options-list"></div>
        <button type="button" class="add-option-btn" onclick="CreateCourse.addOption(${qIdx})">+ Variant qo'shish</button>
      `;

      const optionsContainer = qBlock.querySelector('.options-list');
      q.options.forEach((opt, optIdx) => {
        const optRow = document.createElement('div');
        optRow.className = 'option-row';
        optRow.innerHTML = `
          <input type="radio" name="correct_${qIdx}" class="option-correct" ${opt.is_correct ? 'checked' : ''} title="To'g'ri javob" onchange="CreateCourse.setCorrectOption(${qIdx}, ${optIdx})">
          <input type="text" class="form-control option-text" placeholder="Variant matni..." value="${opt.text || ''}" style="padding: 6px 10px; font-size:13px;" oninput="CreateCourse.quizQuestions[${qIdx}].options[${optIdx}].text = this.value">
          <button type="button" class="remove-option-btn" onclick="CreateCourse.removeOption(${qIdx}, ${optIdx})">✕</button>
        `;
        optionsContainer.appendChild(optRow);
      });

      container.appendChild(qBlock);
    });
  },

  removeQuestion(qIdx) {
    this.quizQuestions.splice(qIdx, 1);
    this.renderQuestionsBuilder();
  },

  addOption(qIdx) {
    const q = this.quizQuestions[qIdx];
    if (q.options.length >= 6) {
      window.toast?.show("Maksimal 6 ta variant bo'lishi mumkin!", 'warning');
      return;
    }
    q.options.push({ text: '', is_correct: false });
    this.renderQuestionsBuilder();
  },

  removeOption(qIdx, optIdx) {
    const q = this.quizQuestions[qIdx];
    if (q.options.length <= 2) {
      window.toast?.show("Kamida 2 ta variant bo'lishi shart!", 'warning');
      return;
    }
    q.options.splice(optIdx, 1);
    const correctLeft = q.options.some(o => o.is_correct);
    if (!correctLeft && q.options.length > 0) {
      q.options[0].is_correct = true;
    }
    this.renderQuestionsBuilder();
  },

  setCorrectOption(qIdx, optIdx) {
    this.quizQuestions[qIdx].options.forEach((opt, i) => {
      opt.is_correct = i === optIdx;
    });
  },

  collectQuizData() {
    const questions = [];
    for (let i = 0; i < this.quizQuestions.length; i++) {
      const q = this.quizQuestions[i];
      const text = q.text.trim();
      
      if (!text) {
        window.toast?.show(`Savol #${i+1} matni bo'sh bo'lishi mumkin emas!`, 'error');
        return null;
      }

      if (q.options.length < 2) {
        window.toast?.show(`Savol #${i+1} da kamida 2 ta variant bo'lishi shart!`, 'error');
        return null;
      }

      const hasCorrect = q.options.some(opt => opt.is_correct);
      if (!hasCorrect) {
        window.toast?.show(`Savol #${i+1} da to'g'ri javob belgilanmagan!`, 'error');
        return null;
      }

      const cleanedOptions = q.options.map(opt => {
        return {
          text: opt.text.trim(),
          is_correct: opt.is_correct
        };
      });

      const hasEmptyOption = cleanedOptions.some(opt => !opt.text);
      if (hasEmptyOption) {
        window.toast?.show(`Savol #${i+1} da variantlar matni bo'sh bo'lishi mumkin emas!`, 'error');
        return null;
      }

      questions.push({
        text,
        options: cleanedOptions,
        order: i
      });
    }
    return questions;
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
