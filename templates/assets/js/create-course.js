// create-course.js — kurs yaratish va darslar qo'shish
const CreateCourse = {
  course: null,
  thumbFile: null,
  categories: [],

  getMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const apiBase = window.APP_CONFIG?.API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
    try {
      const origin = new URL(apiBase).origin;
      return origin + url;
    } catch(e) {
      if (apiBase.startsWith('/')) return url;
      return apiBase.split('/api')[0] + url;
    }
  },

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
        // Show delete button when editing existing course
        const deleteBtn = document.getElementById('btnDeleteCourse');
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
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
    document.getElementById('addHomeworkBtn')?.addEventListener('click', () => this.openHomeworkModal());
    document.getElementById('btnDeleteCourse')?.addEventListener('click', () => this.deleteCourse());

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
      const thumbUrl = this.getMediaUrl(this.course.thumbnail);
      document.querySelector('.cp-thumb').innerHTML = `<img src="${thumbUrl}" style="width:100%;height:100%;object-fit:cover">`;
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

  async deleteCourse() {
    if (!this.course) {
      window.toast?.show("O'chiriladigan kurs topilmadi!", 'error');
      return;
    }
    const confirmed = confirm(`"${this.course.title}" kursini o'chirmoqchimisiz?\n\nBarcha darslar, modullar va vazifalar ham o'chib ketadi!`);
    if (!confirmed) return;

    try {
      await API.delete(`/courses/teacher/courses/${this.course.slug}/`);
      window.toast?.show("Kurs muvaffaqiyatli o'chirildi!", 'success');
      setTimeout(() => {
        window.location.href = 'dashboard-teacher.html';
      }, 1200);
    } catch (e) {
      window.toast?.show(e.message || "O'chirishda xatolik!", 'error');
    }
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
                <i class="ti ti-${l.lesson_type === 'quiz' ? 'help' : l.lesson_type === 'text' ? 'book' : l.lesson_type === 'homework' ? 'clipboard' : 'video'}" style="color:var(--duo-green)"></i>
                <span style="font-weight:600">${l.title}</span>
                <span style="font-size:11px; color:var(--muted)">(${l.lesson_type === 'video' ? 'Video' : l.lesson_type === 'text' ? 'Matn' : l.lesson_type === 'quiz' ? 'Test' : 'Vazifa'})</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:12px;color:var(--muted)">${l.duration_display || ''}</span>
                <button type="button" class="btn-secondary btn-edit-lesson" data-module-id="${mod.id}" data-lesson-id="${l.id}" style="padding:4px 8px; border:none; cursor:pointer;" title="Tahrirlash"><i class="ti ti-edit"></i></button>
                <button type="button" class="btn-secondary btn-delete-lesson" data-lesson-id="${l.id}" style="padding:4px 8px; border:none; cursor:pointer; color:var(--rose);" title="O'chirish"><i class="ti ti-trash"></i></button>
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

    container.querySelectorAll('.btn-delete-lesson').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteLesson(btn.dataset.lessonId);
      });
    });
  },

  async deleteLesson(lessonId) {
    if (!confirm("Haqiqatan ham ushbu darsni o'chirmoqchimisiz?")) return;
    try {
      await API.delete(`/courses/lessons/${lessonId}/update/`);
      window.toast?.show("Dars o'chirildi", 'success');
      await this.refreshCourse();
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
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
    document.getElementById('ytPreview').style.display = 'none';

    // Bind UI change handlers
    this.initLessonModalEvents();

    if (lessonId) {
      this.loadLessonData(lessonId);
    } else {
      this.setVideoSource('url');
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
      document.getElementById('lessonTextContent').value = l.text_content || '';
      document.getElementById('lessonHomeworkDesc').value = l.homework_description || '';
      document.getElementById('lessonHomeworkDeadline').value = l.homework_deadline_days || '';
      
      if (l.video_url && (l.video_url.includes('youtube.com') || l.video_url.includes('youtu.be'))) {
        this.setVideoSource('url');
        document.getElementById('lessonVideoUrl').value = l.video_url;
        this.showYouTubePreview(l.video_url);
      } else {
        this.setVideoSource('file');
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

  setVideoSource(source) {
    document.getElementById('videoSource').value = source;
    const urlBtn = document.getElementById('sourceUrlBtn');
    const fileBtn = document.getElementById('sourceFileBtn');
    if (source === 'url') {
      urlBtn.classList.add('active');
      fileBtn.classList.remove('active');
      document.getElementById('videoUrlGroup').style.display = 'block';
      document.getElementById('videoFileGroup').style.display = 'none';
    } else {
      urlBtn.classList.remove('active');
      fileBtn.classList.add('active');
      document.getElementById('videoUrlGroup').style.display = 'none';
      document.getElementById('videoFileGroup').style.display = 'block';
    }
  },

  toggleLessonTypeFields() {
    const type = document.getElementById('lessonType').value;

    document.getElementById('videoFields').style.display = type === 'video' ? 'flex' : 'none';
    document.getElementById('textFields').style.display = type === 'text' ? 'block' : 'none';
    document.getElementById('quizFields').style.display = type === 'quiz' ? 'block' : 'none';
    
    // Always show resource fields — auto-save will handle the rest
    document.getElementById('resourceNotSavedWarning').style.display = 'none';
    document.getElementById('resourceList').style.display = 'block';
    document.getElementById('resourceAddRow').style.display = 'flex';
  },

  extractYouTubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  },

  showYouTubePreview(url) {
    const ytId = this.extractYouTubeId(url);
    const previewDiv = document.getElementById('ytPreview');
    const previewImg = document.getElementById('ytPreviewImg');
    if (ytId) {
      previewImg.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      previewDiv.style.display = 'block';
    } else {
      previewDiv.style.display = 'none';
    }
  },

  initLessonModalEvents() {
    // Setup change triggers
    document.getElementById('lessonType').onchange = () => this.toggleLessonTypeFields();
    
    // YouTube link preview update
    document.getElementById('lessonVideoUrl').oninput = (e) => {
      this.showYouTubePreview(e.target.value.trim());
    };

    document.getElementById('resourceType').onchange = (e) => {
      const isFile = e.target.value === 'file';
      document.getElementById('resourceFile').style.display = isFile ? 'block' : 'none';
      document.getElementById('resourceUrl').style.display = isFile ? 'none' : 'block';
    };

    // Add Resource Click
    document.getElementById('addResourceBtn').onclick = async () => {
      // Auto-save lesson first if not saved yet
      if (!this.currentLessonId) {
        const lTitle = document.getElementById('lessonTitle').value.trim();
        if (!lTitle) {
          window.toast?.show("Avval dars nomini kiriting!", 'warning');
          return;
        }
        window.toast?.show("Dars saqlanmoqda...", 'info');
        try {
          const lType = document.getElementById('lessonType').value;
          const fd2 = new FormData();
          fd2.append('title', lTitle);
          fd2.append('lesson_type', lType);
          if (lType === 'video') {
            const vSource = document.getElementById('videoSource').value;
            if (vSource === 'url') {
              const vUrl = document.getElementById('lessonVideoUrl').value.trim();
              if (vUrl) fd2.append('video_url', vUrl);
            }
          } else if (lType === 'text') {
            fd2.append('text_content', document.getElementById('lessonTextContent').value.trim());
          }
          const saveRes = await API.post(`/courses/teacher/modules/${this.currentModuleId}/lessons/`, fd2);
          this.currentLessonId = saveRes.data.id;
          window.toast?.show("Dars saqlandi! Endi resurs qo'shilmoqda...", 'success');
        } catch (saveErr) {
          window.toast?.show("Darsni saqlashda xatolik: " + saveErr.message, 'error');
          return;
        }
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
        const allowedExts = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'zip', 'jpg', 'jpeg', 'png'];
        const ext = file.name.split('.').pop().toLowerCase();
        if (!allowedExts.includes(ext)) {
          window.toast?.show("Fayl formati noto'g'ri! Faqat: pdf, doc, docx, ppt, pptx, zip, jpg, png", 'error');
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
        window.toast?.show("Resurs yuklanmoqda...", "info");
        const res = await API.post(`/courses/lessons/${this.currentLessonId}/resources/`, fd);
        window.toast?.show("Resurs muvaffaqiyatli qo'shildi!", "success");
        
        this.lessonResources.push(res.data);
        this.renderResourceList();

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
      
      if (!lTitle) {
        window.toast?.show("Dars nomini kiriting!", 'error');
        return;
      }

      const fd = new FormData();
      fd.append('title', lTitle);
      fd.append('lesson_type', lType);

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
      } else if (lType === 'text') {
        const textVal = document.getElementById('lessonTextContent').value.trim();
        fd.append('text_content', textVal);
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
        if (lType === 'quiz') {
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

  homeworkList: [],
  currentHomeworkId: null,
  homeworkResources: [],

  async renderHomeworkList() {
    const container = document.getElementById('homeworkListContainer');
    if (!container) return;

    if (!this.course) {
      container.innerHTML = '<p class="empty-state">Avval kursni saqlang.</p>';
      return;
    }

    try {
      const res = await API.get(`/courses/teacher/courses/${this.course.slug}/homeworks/`);
      this.homeworkList = res.data || [];
    } catch (e) {
      this.homeworkList = [];
    }

    if (this.homeworkList.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:32px; text-align:center; color:var(--muted);">
          <span style="font-size:40px;">📋</span>
          <p style="margin-top:8px;">Hali vazifa qo'shilmagan. Vazifalar ixtiyoriy — kerak bo'lsa qo'shing.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.homeworkList.map((hw) => `
      <div class="homework-item" data-homework-id="${hw.id}" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid var(--border); border-radius:12px; margin-bottom:8px; background:var(--white);">
        <div class="homework-item-icon" style="font-size:24px;">📝</div>
        <div class="homework-item-info" style="display:flex; flex-direction:column; flex:1;">
          <span class="homework-item-title" style="font-size:14px; font-weight:600;">${hw.title}</span>
          <span class="homework-item-meta" style="font-size:12px; color:var(--muted); margin-top:2px;">
            ${hw.deadline_days ? hw.deadline_days + ' kun muddat' : 'Muddatsiz'} 
            ${hw.after_lesson_title ? '· ' + hw.after_lesson_title + 'dan keyin' : '· Kurs boshida'}
          </span>
        </div>
        <div class="homework-item-actions" style="display:flex; gap:8px;">
          <button type="button" class="btn-secondary btn-edit-homework" data-homework-id="${hw.id}" style="padding:4px 8px; border:none; cursor:pointer;" title="Tahrirlash"><i class="ti ti-edit"></i></button>
          <button type="button" class="btn-secondary btn-delete-homework" data-homework-id="${hw.id}" style="padding:4px 8px; border:none; cursor:pointer; color:var(--rose);" title="O'chirish"><i class="ti ti-trash"></i></button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-edit-homework').forEach((btn) => {
      btn.onclick = () => this.openHomeworkModal(btn.dataset.homeworkId);
    });

    container.querySelectorAll('.btn-delete-homework').forEach((btn) => {
      btn.onclick = () => this.deleteHomework(btn.dataset.homeworkId);
    });
  },

  async deleteHomework(id) {
    if (!confirm("Haqiqatan ham ushbu vazifani o'chirmoqchimisiz?")) return;
    try {
      await API.delete(`/courses/teacher/courses/homeworks/${id}/`);
      window.toast?.show("Vazifa o'chirildi", 'success');
      await this.renderHomeworkList();
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  openHomeworkModal(homeworkId = null) {
    this.currentHomeworkId = homeworkId;
    this.homeworkResources = [];

    // Reset form
    document.getElementById('homeworkForm').reset();
    document.getElementById('hwModalTitle').textContent = homeworkId ? 'Vazifani tahrirlash' : 'Yangi vazifa qo\'shish';
    document.getElementById('hwResourceList').innerHTML = '';

    // Populate after lesson options
    const select = document.getElementById('homeworkAfterLesson');
    if (select) {
      select.innerHTML = '<option value="">— Tanlanmagan (kurs boshida) —</option>';
      (this.course?.modules || []).forEach((mod) => {
        (mod.lessons || []).forEach((les) => {
          select.innerHTML += `<option value="${les.id}">${les.title} (${mod.title})</option>`;
        });
      });
    }

    this.initHomeworkModalEvents();

    if (homeworkId) {
      this.loadHomeworkData(homeworkId);
    } else {
      this.toggleHomeworkResourceFields();
      document.getElementById('homeworkModal').style.display = 'flex';
    }
  },

  async loadHomeworkData(homeworkId) {
    try {
      const res = await API.get(`/courses/teacher/courses/homeworks/${homeworkId}/`);
      const hw = res.data;
      document.getElementById('homeworkTitle').value = hw.title || '';
      document.getElementById('homeworkDescription').value = hw.description || '';
      document.getElementById('homeworkAfterLesson').value = hw.after_lesson || '';
      document.getElementById('homeworkDeadlineDays').value = hw.deadline_days || '';

      this.homeworkResources = hw.resources || [];
      this.renderHwResourceList();

      this.toggleHomeworkResourceFields();
      document.getElementById('homeworkModal').style.display = 'flex';
    } catch (err) {
      window.toast?.show('Vazifa ma\'lumotlarini yuklashda xatolik: ' + err.message, 'error');
    }
  },

  closeHomeworkModal() {
    document.getElementById('homeworkModal').style.display = 'none';
  },

  toggleHomeworkResourceFields() {
    const hasHwId = !!this.currentHomeworkId;
    document.getElementById('hwResourceNotSavedWarning').style.display = hasHwId ? 'none' : 'block';
    document.getElementById('hwResourceList').style.display = hasHwId ? 'block' : 'none';
    document.getElementById('hwResourceAddRow').style.display = hasHwId ? 'flex' : 'none';
  },

  initHomeworkModalEvents() {
    document.getElementById('hwResourceType').onchange = (e) => {
      const isFile = e.target.value === 'file';
      document.getElementById('hwResourceFile').style.display = isFile ? 'block' : 'none';
      document.getElementById('hwResourceUrl').style.display = isFile ? 'none' : 'block';
    };

    // Add Homework Resource Click
    document.getElementById('addHwResourceBtn').onclick = async () => {
      if (!this.currentHomeworkId) {
        window.toast?.show("Avval vazifani saqlab oling!", 'warning');
        return;
      }

      const rType = document.getElementById('hwResourceType').value;
      const rTitle = document.getElementById('hwResourceTitle').value.trim();
      
      if (!rTitle) {
        window.toast?.show("Material nomini kiriting!", 'error');
        return;
      }

      const fd = new FormData();
      fd.append('title', rTitle);
      fd.append('resource_type', rType);

      if (rType === 'file') {
        const fileInput = document.getElementById('hwResourceFile');
        const file = fileInput.files[0];
        if (!file) {
          window.toast?.show("Fayl tanlang!", 'error');
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          window.toast?.show("Fayl hajmi 10 MB dan oshmasligi kerak!", 'error');
          return;
        }
        const allowedExts = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'zip', 'jpg', 'jpeg', 'png'];
        const ext = file.name.split('.').pop().toLowerCase();
        if (!allowedExts.includes(ext)) {
          window.toast?.show("Fayl formati noto'g'ri!", 'error');
          return;
        }
        fd.append('file', file);
      } else {
        const url = document.getElementById('hwResourceUrl').value.trim();
        if (!url) {
          window.toast?.show("Havolani kiriting!", 'error');
          return;
        }
        fd.append('url', url);
      }

      try {
        window.toast?.show("Yuklanmoqda...", "info");
        const res = await API.post(`/courses/homeworks/${this.currentHomeworkId}/resources/`, fd);
        window.toast?.show("Material qo'shildi!", "success");
        
        this.homeworkResources.push(res.data);
        this.renderHwResourceList();

        document.getElementById('hwResourceTitle').value = '';
        document.getElementById('hwResourceFile').value = '';
        document.getElementById('hwResourceUrl').value = '';
      } catch (err) {
        window.toast?.show(err.message, 'error');
      }
    };

    // Save Homework Form
    document.getElementById('homeworkForm').onsubmit = async (e) => {
      e.preventDefault();
      const title = document.getElementById('homeworkTitle').value.trim();
      const description = document.getElementById('homeworkDescription').value.trim();
      const afterLesson = document.getElementById('homeworkAfterLesson').value;
      const deadlineDays = document.getElementById('homeworkDeadlineDays').value;

      if (!title) {
        window.toast?.show("Vazifa sarlavhasini kiriting!", 'error');
        return;
      }

      const payload = {
        title,
        description,
        after_lesson: afterLesson || null,
        deadline_days: deadlineDays || null
      };

      try {
        if (this.currentHomeworkId) {
          await API.patch(`/courses/teacher/courses/homeworks/${this.currentHomeworkId}/`, payload);
        } else {
          const res = await API.post(`/courses/teacher/courses/${this.course.slug}/homeworks/`, payload);
          this.currentHomeworkId = res.data.id;
        }

        window.toast?.show("Vazifa saqlandi!", 'success');
        this.closeHomeworkModal();
        await this.renderHomeworkList();
      } catch (err) {
        window.toast?.show(err.message, 'error');
      }
    };
  },

  renderHwResourceList() {
    const container = document.getElementById('hwResourceList');
    if (!container) return;

    if (this.homeworkResources.length === 0) {
      container.innerHTML = '<p class="empty-state" style="padding: 8px;">Materiallar yo\'q.</p>';
      return;
    }

    container.innerHTML = this.homeworkResources.map(r => `
      <div class="resource-builder-item" style="display: flex; align-items: center; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; margin-bottom: 6px;">
        <span class="title" style="font-size: 13px; font-weight: 600;">${r.title} (${r.resource_type === 'link' ? 'Havola' : 'Fayl'})</span>
        <button type="button" class="remove-btn" onclick="CreateCourse.deleteHwResource(${r.id})" style="color: var(--rose); cursor: pointer; border: none; background: none;">✕</button>
      </div>
    `).join('');
  },

  async deleteHwResource(id) {
    if (!confirm("Haqiqatan ham ushbu materialni o'chirmoqchimisiz?")) return;
    try {
      await API.delete(`/courses/homeworks/resources/${id}/`);
      window.toast?.show("Material o'chirildi", 'success');
      this.homeworkResources = this.homeworkResources.filter(r => r.id !== id);
      this.renderHwResourceList();
    } catch (err) {
      window.toast?.show(err.message, 'error');
    }
  },
};

document.addEventListener('DOMContentLoaded', () => CreateCourse.init());
