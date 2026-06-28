// create-course.js — kurs yaratish va darslar qo'shish
const CreateCourse = {
  showConfirm(title, message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('customConfirmModal');
      const titleEl = document.getElementById('confirmModalTitle');
      const msgEl = document.getElementById('confirmModalMessage');
      const cancelBtn = document.getElementById('confirmModalCancelBtn');
      const confirmBtn = document.getElementById('confirmModalConfirmBtn');

      titleEl.textContent = title;
      msgEl.textContent = message;
      modal.style.display = 'flex';

      const cleanUp = (result) => {
        modal.style.display = 'none';
        cancelBtn.onclick = null;
        confirmBtn.onclick = null;
        resolve(result);
      };

      cancelBtn.onclick = () => cleanUp(false);
      confirmBtn.onclick = () => cleanUp(true);
    });
  },
  course: null,
  thumbFile: null,
  categories: [],

  getMediaUrl(url) {
    return App.getMediaUrl(url);
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

        // Show step 5 tab if private
        if (this.course.is_private) {
          const step5Tab = document.getElementById('step5-tab');
          const step5Line = document.getElementById('step5-line');
          const btnGoToStep5 = document.getElementById('btnGoToStep5');
          if (step5Tab) step5Tab.style.display = 'flex';
          if (step5Line) step5Line.style.display = 'block';
          if (btnGoToStep5) btnGoToStep5.style.display = 'inline-block';
        }
      } catch (e) {
        window.toast?.show(e.message, 'error');
      }
    } else {
      this.selectCourseType('public');
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
    // Delegated event listener for thumbInput so it survives DOM updates
    document.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'thumbInput') {
        this.thumbFile = e.target.files[0];
        if (this.thumbFile) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const thumb = document.querySelector('.cp-thumb');
            if (thumb) thumb.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover">`;
            
            const uploadZone = document.querySelector('.upload-zone');
            if (uploadZone) {
              uploadZone.style.backgroundImage = `url(${ev.target.result})`;
              uploadZone.style.backgroundSize = 'cover';
              uploadZone.style.backgroundPosition = 'center';
              uploadZone.innerHTML = `<input type="file" id="thumbInput" style="display:none;" accept="image/jpeg, image/png">`;
            }
          };
          reader.readAsDataURL(this.thumbFile);
        }
        this.updateChecklist();
      }
    });

    document.getElementById('courseTitle')?.addEventListener('input', () => this.updatePreview());
    document.getElementById('coursePrice')?.addEventListener('input', () => this.updatePreview());
    document.getElementById('freeSwitch')?.addEventListener('change', () => this.updatePreview());

    document.getElementById('btnAddModule')?.addEventListener('click', () => this.addModule());
    document.getElementById('btnSaveDraft')?.addEventListener('click', () => this.saveStep1(true));
    document.getElementById('btnStep1Next')?.addEventListener('click', () => this.saveStep1(false));
    document.getElementById('btnPublish')?.addEventListener('click', () => this.handleStep4Action());
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
      
      const uploadZone = document.querySelector('.upload-zone');
      if (uploadZone) {
        uploadZone.style.backgroundImage = `url(${thumbUrl})`;
        uploadZone.style.backgroundSize = 'cover';
        uploadZone.style.backgroundPosition = 'center';
        uploadZone.innerHTML = `<input type="file" id="thumbInput" style="display:none;" accept="image/jpeg, image/png">`;
      }
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
    
    // Fill privacy settings
    if (document.getElementById('isPrivate')) {
      document.getElementById('isPrivate').checked = this.course.is_private || false;
    }
    if (document.getElementById('requireApproval')) {
      document.getElementById('requireApproval').checked = this.course.require_approval || false;
    }
    if (document.getElementById('enrollmentLimit')) {
      document.getElementById('enrollmentLimit').value = this.course.enrollment_limit || '';
    }

    this.selectCourseType(this.course.is_private ? 'private' : 'public');
    this.handleApprovalToggle();

    if (this.course.status === 'published') {
      const btnAction = document.getElementById('btnStep4Action');
      if (btnAction) {
        btnAction.style.display = 'none';
      }

      if (this.course.is_private) {
        document.getElementById('privateInviteSection').style.display = 'block';
        this.loadEditInviteLink();
      } else {
        document.getElementById('publicPublishSuccess').style.display = 'block';
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

        // Show step 5 tab
        const step5Tab = document.getElementById('step5-tab');
        const step5Line = document.getElementById('step5-line');
        const btnGoToStep5 = document.getElementById('btnGoToStep5');
        if (step5Tab) step5Tab.style.display = 'flex';
        if (step5Line) step5Line.style.display = 'block';
        if (btnGoToStep5) btnGoToStep5.style.display = 'inline-block';
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

  addModule() {
    if (!this.course?.slug) {
      window.toast?.show('Avval 1-qadamni saqlang', 'error');
      return;
    }
    document.getElementById('btnAddModule').style.display = 'none';
    document.getElementById('addModuleForm').style.display = 'flex';
    document.getElementById('newModuleTitle').value = '';
    document.getElementById('newModuleTitle').focus();
  },

  cancelAddModule() {
    document.getElementById('addModuleForm').style.display = 'none';
    document.getElementById('btnAddModule').style.display = 'inline-block';
  },

  async saveNewModule() {
    const title = document.getElementById('newModuleTitle').value.trim();
    if (!title) {
      window.toast?.show("Bo'lim nomini kiriting!", 'error');
      return;
    }
    try {
      await API.post(`/courses/teacher/courses/${this.course.slug}/modules/`, { title });
      await this.refreshCourse();
      window.toast?.show("Bo'lim qo'shildi", 'success');
      this.cancelAddModule();
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
    const confirmed = await this.showConfirm(
      "Kursni o'chirish",
      `"${this.course.title}" kursini o'chirmoqchimisiz?\n\nBarcha darslar, modullar va vazifalar ham o'chib ketadi!`
    );
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
    if (!await this.showConfirm("Darsni o'chirish", "Haqiqatan ham ushbu darsni o'chirmoqchimisiz?")) return;
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
  localResources: [],

  openLessonModal(moduleId, lessonId = null) {
    this.currentModuleId = moduleId;
    this.currentLessonId = lessonId;
    this.quizQuestions = [];
    this.lessonResources = [];
    this.localResources = [];

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
      
      if (l.video_url) {
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
      const rType = document.getElementById('resourceType').value;
      const rTitle = document.getElementById('resourceTitle').value.trim();
      
      if (!rTitle) {
        window.toast?.show("Resurs nomini kiriting!", 'error');
        return;
      }

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

        if (this.currentLessonId) {
          // Upload immediately for already created lesson
          try {
            window.toast?.show("Resurs yuklanmoqda...", "info");
            const fd = new FormData();
            fd.append('title', rTitle);
            fd.append('resource_type', rType);
            fd.append('file', file);
            const res = await API.post(`/courses/lessons/${this.currentLessonId}/resources/`, fd);
            window.toast?.show("Resurs muvaffaqiyatli qo'shildi!", "success");
            this.lessonResources.push(res.data);
            this.renderResourceList();
          } catch (err) {
            window.toast?.show(err.message, 'error');
          }
        } else {
          // Stage locally
          this.localResources.push({
            title: rTitle,
            resource_type: rType,
            file: file,
            url: ''
          });
          this.renderResourceList();
          window.toast?.show("Resurs vaqtinchalik saqlandi. Dars saqlanganda yuklanadi.", "info");
        }
      } else {
        const url = document.getElementById('resourceUrl').value.trim();
        if (!url) {
          window.toast?.show("Havolani kiriting!", 'error');
          return;
        }

        if (this.currentLessonId) {
          // Upload immediately for already created lesson
          try {
            window.toast?.show("Resurs qo'shilmoqda...", "info");
            const fd = new FormData();
            fd.append('title', rTitle);
            fd.append('resource_type', rType);
            fd.append('url', url);
            const res = await API.post(`/courses/lessons/${this.currentLessonId}/resources/`, fd);
            window.toast?.show("Resurs muvaffaqiyatli qo'shildi!", "success");
            this.lessonResources.push(res.data);
            this.renderResourceList();
          } catch (err) {
            window.toast?.show(err.message, 'error');
          }
        } else {
          // Stage locally
          this.localResources.push({
            title: rTitle,
            resource_type: rType,
            file: null,
            url: url
          });
          this.renderResourceList();
          window.toast?.show("Resurs vaqtinchalik saqlandi. Dars saqlanganda yuklanadi.", "info");
        }
      }

      document.getElementById('resourceTitle').value = '';
      document.getElementById('resourceFile').value = '';
      document.getElementById('resourceUrl').value = '';
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

      const submitBtn = e.target.querySelector('button[type="submit"]');
      let originalBtnText = '';
      if (submitBtn) {
        originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Saqlanmoqda...';
      }

      const fd = new FormData();
      fd.append('title', lTitle);
      fd.append('lesson_type', lType);

      if (lType === 'video') {
        const vSource = document.getElementById('videoSource').value;
        if (vSource === 'url') {
          const vUrl = document.getElementById('lessonVideoUrl').value.trim();
          if (!vUrl) {
            window.toast?.show("Video havolasini kiriting!", 'error');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = originalBtnText;
            }
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

        // Upload staged local resources
        if (this.localResources && this.localResources.length > 0) {
          for (const localRes of this.localResources) {
            const resFd = new FormData();
            resFd.append('title', localRes.title);
            resFd.append('resource_type', localRes.resource_type);
            if (localRes.resource_type === 'file') {
              resFd.append('file', localRes.file);
            } else {
              resFd.append('url', localRes.url);
            }
            await API.post(`/courses/lessons/${this.currentLessonId}/resources/`, resFd);
          }
          this.localResources = [];
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
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      }
    };
  },

  renderResourceList() {
    const container = document.getElementById('resourceList');
    if (!container) return;

    const totalCount = this.lessonResources.length + this.localResources.length;
    if (totalCount === 0) {
      container.innerHTML = '<p class="empty-state" style="padding: 8px;">Resurslar yo\'q.</p>';
      return;
    }

    let html = '';
    // Render already saved resources
    html += this.lessonResources.map(r => `
      <div class="resource-builder-item" style="display:flex; justify-content:space-between; align-items:center; background:var(--surface); padding:8px 12px; border-radius:8px; margin-bottom:6px;">
        <span class="title" style="font-size:13px; font-weight:500;">${r.title} (${r.resource_type === 'link' ? 'Havola' : 'Fayl'})</span>
        <button type="button" class="remove-btn" onclick="CreateCourse.deleteResource(${r.id})" style="background:none; border:none; color:var(--rose); cursor:pointer; font-weight:700;">✕</button>
      </div>
    `).join('');

    // Render locally staged resources (not yet saved)
    html += this.localResources.map((r, idx) => `
      <div class="resource-builder-item" style="display:flex; justify-content:space-between; align-items:center; background:var(--surface); padding:8px 12px; border-radius:8px; margin-bottom:6px; border: 1px dashed var(--accent);">
        <span class="title" style="font-size:13px; font-weight:500;">${r.title} (${r.resource_type === 'link' ? 'Havola' : 'Fayl'}) <em style="font-size:11px; color:var(--muted)">(Saqlanmagan)</em></span>
        <button type="button" class="remove-btn" onclick="CreateCourse.deleteLocalResource(${idx})" style="background:none; border:none; color:var(--rose); cursor:pointer; font-weight:700;">✕</button>
      </div>
    `).join('');

    container.innerHTML = html;
  },

  deleteLocalResource(idx) {
    this.localResources.splice(idx, 1);
    this.renderResourceList();
  },

  async deleteResource(id) {
    if (!await this.showConfirm("Materialni o'chirish", "Haqiqatan ham ushbu resursni o'chirmoqchimisiz?")) return;
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

  async handleStep4Action() {
    if (!this.course) {
      window.toast?.show('Avval kursni saqlang', 'error');
      return;
    }
    const isPrivate = document.getElementById('isPrivate').checked;

    if (!isPrivate) {
      // Holat A confirmation modal
      const modal = document.getElementById('publishConfirmModal');
      const modalBody = document.getElementById('publishModalBody');
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 16px 0;">
          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
          <h3 style="font-family: 'Plus Jakarta Sans'; font-size: 20px; font-weight: 700; margin-bottom: 12px; color: var(--ink);">Kursni nashr etishga tayyormisiz?</h3>
          <p style="color: var(--muted); font-size: 14px; margin-bottom: 16px;">Kurs katalogda ko'rinadi va har kim yozila oladi.</p>
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; font-size: 13px; font-family: monospace; word-break: break-all; margin-bottom: 24px; color: var(--blue);">
            🔗 Havola avtomatik yaratiladi:<br>
            ${window.location.origin}/courses/${this.course.slug}/
          </div>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button type="button" onclick="CreateCourse.closePublishModal()" class="btn-secondary" style="padding: 10px 20px;">BEKOR QILISH</button>
            <button type="button" onclick="CreateCourse.executePublish()" class="btn-primary" style="padding: 10px 20px; background: #16A34A; border-color: #16A34A;">✓ NASHR ETISH</button>
          </div>
        </div>
      `;
      modal.style.display = 'flex';
    } else {
      // Private course: Save settings first, then publish and show invite modal (B or C)
      try {
        const requireApproval = document.getElementById('requireApproval').checked;
        const enrollmentLimitVal = document.getElementById('enrollmentLimit').value;
        const enrollmentLimit = enrollmentLimitVal ? parseInt(enrollmentLimitVal) : null;

        window.toast?.show("Kurs nashr etilmoqda...", "info");
        
        const res = await API.post(`/courses/teacher/courses/${this.course.slug}/publish/`, {
          is_private: true,
          require_approval: requireApproval,
          max_students: enrollmentLimit
        });
        window.toast?.show('Kurs muvaffaqiyatli nashr etildi! 🎉', 'success');

        const inviteToken = res.invite_token || res.data?.invite_token || res.data?.token || "";
        const inviteUrl = res.invite_url || res.data?.invite_url || `${window.location.origin}/invite/${inviteToken}/`;
        
        const limitText = enrollmentLimit ? `(chegara: ${enrollmentLimit} o'quvchi)` : '';

        const modal = document.getElementById('publishConfirmModal');
        const modalBody = document.getElementById('publishModalBody');

        if (!requireApproval) {
          // Holat B
          modalBody.innerHTML = `
            <div style="text-align: center; padding: 16px 0;">
              <div style="font-size: 48px; margin-bottom: 16px;">🔗</div>
              <h3 style="font-family: 'Plus Jakarta Sans'; font-size: 20px; font-weight: 700; margin-bottom: 12px; color: var(--ink);">Taklif havolasi</h3>
              <p style="color: var(--muted); font-size: 14px; margin-bottom: 16px;">
                Quyidagi havolani o'quvchilarga yuboring ${limitText}:
              </p>
              <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; font-size: 13px; font-family: monospace; word-break: break-all; margin-bottom: 12px; color: var(--blue);">
                ${inviteUrl}
              </div>
              <button type="button" id="btnCopyInvite" onclick="CreateCourse.copyInviteLink('${inviteUrl}')" class="btn-secondary" style="width: 100%; margin-bottom: 16px; padding: 10px 16px;">📋 NUSXA OLISH</button>
              <p style="font-size: 13px; color: var(--muted); margin-bottom: 24px;">
                O'quvchi havolaga kirib, darhol yoziladi (tasdiqlash talab etilmaydi)
              </p>
              <div style="display: flex; gap: 12px; justify-content: center;">
                <button type="button" onclick="CreateCourse.closePublishModal()" class="btn-secondary" style="padding: 10px 20px;">YOPISH</button>
                <button type="button" onclick="CreateCourse.completePublishPrivate()" class="btn-primary" style="padding: 10px 20px; background: #16A34A; border-color: #16A34A;">✓ TAYYOR</button>
              </div>
            </div>
          `;
        } else {
          // Holat C
          modalBody.innerHTML = `
            <div style="text-align: center; padding: 16px 0;">
              <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
              <h3 style="font-family: 'Plus Jakarta Sans'; font-size: 20px; font-weight: 700; margin-bottom: 12px; color: var(--ink);">Taklif havolasi (Tasdiqlash bilan)</h3>
              <p style="color: var(--muted); font-size: 14px; margin-bottom: 16px;">
                Quyidagi havolani o'quvchilarga yuboring ${limitText}:
              </p>
              <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; font-size: 13px; font-family: monospace; word-break: break-all; margin-bottom: 12px; color: var(--blue);">
                ${inviteUrl}
              </div>
              <button type="button" id="btnCopyInvite" onclick="CreateCourse.copyInviteLink('${inviteUrl}')" class="btn-secondary" style="width: 100%; margin-bottom: 16px; padding: 10px 16px;">📋 NUSXA OLISH</button>
              <p style="font-size: 13px; color: #b45309; margin-bottom: 24px; font-weight: 500;">
                ⚠️ O'quvchi havolaga kirgach, ariza yuboradi — siz tasdiqlashingiz kerak bo'ladi (Ustoz panelingizda ko'rinadi)
              </p>
              <div style="display: flex; gap: 12px; justify-content: center;">
                <button type="button" onclick="CreateCourse.closePublishModal()" class="btn-secondary" style="padding: 10px 20px;">YOPISH</button>
                <button type="button" onclick="CreateCourse.completePublishPrivate()" class="btn-primary" style="padding: 10px 20px; background: #16A34A; border-color: #16A34A;">✓ TAYYOR</button>
              </div>
            </div>
          `;
        }
        modal.style.display = 'flex';
      } catch (e) {
        console.error("Publish error:", e);
        const detail = e.data?.detail || e.data?.message || e.message || "Nashr etishda xatolik yuz berdi";
        window.toast?.show(detail, 'error');
      }
    }
  },

  async executePublish() {
    try {
      window.toast?.show("Nashr etilmoqda...", "info");
      await API.post(`/courses/teacher/courses/${this.course.slug}/publish/`, {
        is_private: false,
        require_approval: false,
        max_students: null
      });
      window.toast?.show('Kurs muvaffaqiyatli nashr etildi! 🎉', 'success');
      this.closePublishModal();
      setTimeout(() => {
        window.location.href = 'dashboard-teacher.html';
      }, 1200);
    } catch (e) {
      console.error("Execute publish error:", e);
      const detail = e.data?.detail || e.data?.message || e.message || "Nashr etishda xatolik yuz berdi";
      window.toast?.show(detail, 'error');
    }
  },

  closePublishModal() {
    document.getElementById('publishConfirmModal').style.display = 'none';
  },

  completePublishPrivate() {
    this.closePublishModal();
    nextStep(5);
  },

  copyInviteLink(url) {
    navigator.clipboard.writeText(url);
    window.toast?.show('Havola nusxalandi!', 'success');
    const copyBtn = document.getElementById('btnCopyInvite');
    if (copyBtn) {
      copyBtn.textContent = 'Nusxalandi! ✓';
      copyBtn.style.background = '#F0FDF4';
      copyBtn.style.color = '#16A34A';
      copyBtn.style.borderColor = '#16A34A';
    }
  },

  async loadEditInviteLink() {
    try {
      const res = await API.get(`/courses/teacher/courses/${this.course.slug}/invite/`);
      if (res.success && res.data) {
        const inviteUrl = res.data.invite_url || '';
        document.getElementById('privateInviteUrlDisplay').textContent = inviteUrl;
        
        const limitText = res.data.max_students ? ` / ${res.data.max_students}` : ' (cheksiz)';
        document.getElementById('privateInviteMetaDisplay').textContent = `👥 Yozilganlar: ${res.data.used_count || 0}${limitText}`;
        
        // Add copy button listener
        document.getElementById('btnCopyInviteEdit').onclick = (e) => {
          CreateCourse.copyInviteLinkEdit(e.target, inviteUrl);
        };
        
        // Add regen button listener
        document.getElementById('btnRegenInviteEdit').onclick = async (e) => {
          if (!await this.showConfirm("Havolani yangilash", "Eski taklif havolasi o'chiriladi. Davom etasizmi?")) return;
          const btn = e.target;
          btn.disabled = true;
          btn.textContent = '⏳ Yaratilmoqda...';
          try {
            const regenRes = await API.post(`/courses/teacher/courses/${this.course.slug}/invite/`);
            if (regenRes.success && regenRes.data?.invite_url) {
              window.toast?.show('Yangi havola yaratildi!', 'success');
              CreateCourse.loadEditInviteLink();
            }
          } catch(err) {
            window.toast?.show(err.message, 'error');
          } finally {
            btn.disabled = false;
            btn.textContent = '🔄 Yangi havola yaratish';
          }
        };
      }
    } catch(e) {
      console.error(e);
    }
  },

  async copyInviteLinkEdit(btn, url) {
    try {
      await navigator.clipboard.writeText(url);
      const original = btn.textContent;
      btn.textContent = '✅ Nusxalandi!';
      btn.style.background = '#16A34A';
      btn.style.color = '#fff';
      btn.style.borderColor = '#16A34A';
      setTimeout(() => {
        btn.textContent = original;
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
      }, 2000);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      window.toast?.show('Havola nusxalandi!', 'success');
    }
  },
  copyInviteLink(url) {
    navigator.clipboard.writeText(url);
    window.toast?.show('Havola nusxalandi!', 'success');
    const copyBtn = document.getElementById('btnCopyInvite');
    if (copyBtn) {
      copyBtn.textContent = 'Nusxalandi! ✓';
      copyBtn.style.background = '#F0FDF4';
      copyBtn.style.color = '#16A34A';
      copyBtn.style.borderColor = '#16A34A';
    }
  },

  copyLink(url) {
    navigator.clipboard.writeText(url);
    window.toast?.show('Havola nusxalandi!', 'success');
  },

  async createInviteLink() {
    const maxUses = document.getElementById('newLinkMaxUses').value;
    const expireDays = document.getElementById('newLinkExpireDays').value;
    try {
      await API.post(`/courses/${this.course.slug}/invite/create/`, {
        max_uses: maxUses || null,
        expires_days: expireDays || null
      });
      document.getElementById('newLinkMaxUses').value = '';
      document.getElementById('newLinkExpireDays').value = '';
      this.loadInviteLinks();
      window.toast?.show('Havola yaratildi!', 'success');
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  async loadInviteLinks() {
    try {
      const res = await API.get(`/courses/${this.course.slug}/invite/links/`);
      const links = res.data || [];
      const container = document.getElementById('inviteLinksList');
      container.innerHTML = links.map(l => {
        const fullUrl = `${window.location.origin}/invite/${l.token}/`;
        return `
          <div class="invite-link-row">
            <div class="invite-link-url">
              <span>${fullUrl}</span>
              <button onclick="CreateCourse.copyLink('${fullUrl}')" class="btn-xs">📋</button>
            </div>
            <div class="invite-link-meta">
              ${l.max_uses ? `${l.use_count}/${l.max_uses} foydalanish` : 'Cheksiz'}
              ${l.expires_at ? ` · ${new Date(l.expires_at).toLocaleDateString('uz-UZ')} gacha` : ''}
            </div>
            <div class="invite-link-actions">
              <span class="badge ${l.is_active ? 'badge-green' : 'badge-gray'}">${l.is_active ? 'Faol' : 'O\'chirilgan'}</span>
              <button onclick="CreateCourse.toggleLink('${l.token}')" class="btn-xs">${l.is_active ? 'O\'chirish' : 'Yoqish'}</button>
              <button onclick="CreateCourse.deleteLink('${l.token}')" class="btn-xs danger">🗑</button>
            </div>
          </div>`;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  },

  async loadPublicInviteLink() {
    try {
      const res = await API.get(`/courses/${this.course.slug}/invite/links/`);
      const links = res.data || [];
      const activeLink = links.find(l => l.is_active);
      if (activeLink) {
        const inviteUrl = `${window.location.origin}/invite/${activeLink.token}/`;
        document.getElementById('publishSuccess').innerHTML = `
          <div class="publish-success-card" style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px; margin-top:16px;">
            <h3 style="font-family:'Plus Jakarta Sans'; margin-bottom:12px;">Taklif havolasi</h3>
            <div class="invite-url-box" style="display:flex; align-items:center; justify-content:space-between; gap:8px; background:var(--white); border:1px solid var(--border); padding:8px 12px; border-radius:8px;">
              <span style="font-family:monospace; font-size:13px; color:var(--blue); word-break:break-all;">${inviteUrl}</span>
              <button onclick="CreateCourse.copyLink('${inviteUrl}')" class="btn-secondary" style="padding:6px 12px; font-size:13px; flex-shrink:0;">📋 Nusxa olish</button>
            </div>
          </div>`;
      }
    } catch (e) {
      console.error(e);
    }
  },

  async toggleLink(token) {
    try {
      await API.patch(`/courses/${this.course.slug}/invite/${token}/toggle/`);
      this.loadInviteLinks();
      window.toast?.show('Havola holati o\'zgartirildi', 'success');
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  async deleteLink(token) {
    if (!await this.showConfirm("Havolani o'chirish", "Haqiqatan ham bu havolani o'chirmoqchisiz?")) return;
    try {
      await API.delete(`/courses/${this.course.slug}/invite/${token}/`);
      this.loadInviteLinks();
      window.toast?.show('Havola o\'chirildi', 'success');
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
    if (!await this.showConfirm("Vazifani o'chirish", "Haqiqatan ham ushbu vazifani o'chirmoqchimisiz?")) return;
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
    this.localHwResources = [];

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
    document.getElementById('hwResourceNotSavedWarning').style.display = 'none';
    document.getElementById('hwResourceList').style.display = 'block';
    document.getElementById('hwResourceAddRow').style.display = 'flex';
  },

  initHomeworkModalEvents() {
    document.getElementById('hwResourceType').onchange = (e) => {
      const isFile = e.target.value === 'file';
      document.getElementById('hwResourceFile').style.display = isFile ? 'block' : 'none';
      document.getElementById('hwResourceUrl').style.display = isFile ? 'none' : 'block';
    };

    // Add Homework Resource Click
    document.getElementById('addHwResourceBtn').onclick = async () => {
      const rType = document.getElementById('hwResourceType').value;
      const rTitle = document.getElementById('hwResourceTitle').value.trim();
      
      if (!rTitle) {
        window.toast?.show("Material nomini kiriting!", 'error');
        return;
      }

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

        if (this.currentHomeworkId) {
          try {
            window.toast?.show("Yuklanmoqda...", "info");
            const fd = new FormData();
            fd.append('title', rTitle);
            fd.append('resource_type', rType);
            fd.append('file', file);
            const res = await API.post(`/courses/homeworks/${this.currentHomeworkId}/resources/`, fd);
            window.toast?.show("Material qo'shildi!", "success");
            this.homeworkResources.push(res.data);
            this.renderHwResourceList();
          } catch (err) {
            window.toast?.show(err.message, 'error');
          }
        } else {
          this.localHwResources.push({
            title: rTitle,
            resource_type: rType,
            file: file
          });
          this.renderHwResourceList();
        }
      } else {
        const url = document.getElementById('hwResourceUrl').value.trim();
        if (!url) {
          window.toast?.show("Havolani kiriting!", 'error');
          return;
        }

        if (this.currentHomeworkId) {
          try {
            window.toast?.show("Yuklanmoqda...", "info");
            const fd = new FormData();
            fd.append('title', rTitle);
            fd.append('resource_type', rType);
            fd.append('url', url);
            const res = await API.post(`/courses/homeworks/${this.currentHomeworkId}/resources/`, fd);
            window.toast?.show("Material qo'shildi!", "success");
            this.homeworkResources.push(res.data);
            this.renderHwResourceList();
          } catch (err) {
            window.toast?.show(err.message, 'error');
          }
        } else {
          this.localHwResources.push({
            title: rTitle,
            resource_type: rType,
            url: url
          });
          this.renderHwResourceList();
        }
      }

      document.getElementById('hwResourceTitle').value = '';
      document.getElementById('hwResourceFile').value = '';
      document.getElementById('hwResourceUrl').value = '';
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
        let savedHwId = this.currentHomeworkId;
        if (this.currentHomeworkId) {
          await API.patch(`/courses/teacher/courses/homeworks/${this.currentHomeworkId}/`, payload);
        } else {
          const res = await API.post(`/courses/teacher/courses/${this.course.slug}/homeworks/`, payload);
          savedHwId = res.data.id;
        }

        // Upload staged local homework resources
        if (this.localHwResources && this.localHwResources.length > 0) {
          for (const localRes of this.localHwResources) {
            const resFd = new FormData();
            resFd.append('title', localRes.title);
            resFd.append('resource_type', localRes.resource_type);
            if (localRes.resource_type === 'file') {
              resFd.append('file', localRes.file);
            } else {
              resFd.append('url', localRes.url);
            }
            await API.post(`/courses/homeworks/${savedHwId}/resources/`, resFd);
          }
          this.localHwResources = [];
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

    const totalCount = this.homeworkResources.length + this.localHwResources.length;
    if (totalCount === 0) {
      container.innerHTML = '<p class="empty-state" style="padding: 8px;">Materiallar yo\'q.</p>';
      return;
    }

    let html = '';
    // Render already saved resources
    html += this.homeworkResources.map(r => `
      <div class="resource-builder-item" style="display: flex; align-items: center; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; margin-bottom: 6px;">
        <span class="title" style="font-size: 13px; font-weight: 600;">${r.title} (${r.resource_type === 'link' ? 'Havola' : 'Fayl'})</span>
        <button type="button" class="remove-btn" onclick="CreateCourse.deleteHwResource(${r.id})" style="color: var(--rose); cursor: pointer; border: none; background: none;">✕</button>
      </div>
    `).join('');

    // Render locally staged resources (not yet saved)
    html += this.localHwResources.map((r, idx) => `
      <div class="resource-builder-item" style="display: flex; align-items: center; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; margin-bottom: 6px; border: 1px dashed var(--accent);">
        <span class="title" style="font-size: 13px; font-weight: 600;">${r.title} (${r.resource_type === 'link' ? 'Havola' : 'Fayl'}) <em style="font-size: 11px; color:var(--muted)">(Saqlanmagan)</em></span>
        <button type="button" class="remove-btn" onclick="CreateCourse.removeLocalHwResource(${idx})" style="color: var(--rose); cursor: pointer; border: none; background: none;">✕</button>
      </div>
    `).join('');

    container.innerHTML = html;
  },

  removeLocalHwResource(idx) {
    this.localHwResources.splice(idx, 1);
    this.renderHwResourceList();
  },

  async deleteHwResource(id) {
    if (!await this.showConfirm("Materialni o'chirish", "Haqiqatan ham ushbu materialni o'chirmoqchimisiz?")) return;
    try {
      await API.delete(`/courses/homeworks/resources/${id}/`);
      window.toast?.show("Material o'chirildi", 'success');
      this.homeworkResources = this.homeworkResources.filter(r => r.id !== id);
      this.renderHwResourceList();
    } catch (err) {
      window.toast?.show(err.message, 'error');
    }
  },

  async loadEnrolledStudents() {
    if (!this.course) return;
    try {
      const res = await API.get(`/courses/${this.course.slug}/enrolled-students/`);
      const students = res.data || [];
      
      const titleEl = document.getElementById('enrolledStudentsTitle');
      if (titleEl) {
        const limitStr = this.course.enrollment_limit ? ` / ${this.course.enrollment_limit} ta limit` : '';
        titleEl.textContent = `Kurs o'quvchilar (${students.length} ta yozilgan${limitStr})`;
      }

      const container = document.getElementById('enrolledStudentsList');
      if (!container) return;

      if (students.length === 0) {
        container.innerHTML = '<p class="empty-state">Kursda hali o\'quvchilar yo\'q.</p>';
        return;
      }

      container.innerHTML = students.map(s => {
        const dateStr = s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString('uz-UZ') : '';
        return `
          <div class="resource-builder-item" style="display: flex; align-items: center; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; margin-bottom: 8px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div class="avatar-xs" style="width:36px; height:36px; border-radius:50%; background:var(--duo-green-bg); color:var(--duo-green-dark); font-weight:700; display:flex; align-items:center; justify-content:center; text-transform:uppercase;">${s.student_name ? s.student_name[0] : '?'}</div>
              <div>
                <div style="font-weight:700; font-size:14px;">${s.student_name}</div>
                <div style="font-size:12px; color:var(--muted);">Qo'shildi: ${dateStr} · Progress: ${s.progress_percent || 0}%</div>
              </div>
            </div>
            <button type="button" class="btn-xs danger" onclick="CreateCourse.removeStudent(${s.student_id})" style="border:1px solid var(--rose-light); color:var(--rose); padding:6px 12px; border-radius:8px; cursor:pointer;">❌ Chiqarish</button>
          </div>`;
      }).join('');

    } catch (e) {
      window.toast?.show(e.message || "O'quvchilarni yuklashda xatolik", 'error');
    }
  },

  async removeStudent(studentId) {
    if (!await this.showConfirm("Kursdan chiqarish", "Haqiqatan ham ushbu o'quvchini kursdan chiqarmoqchisiz?")) return;
    try {
      await API.delete(`/courses/${this.course.slug}/enrolled-students/?student_id=${studentId}`);
      window.toast?.show("O'quvchi kursdan chiqarildi", 'success');
      this.loadEnrolledStudents();
    } catch (e) {
      window.toast?.show(e.message || "Xatolik yuz berdi", 'error');
    }
  },

  async addStudentManually() {
    const emailInput = document.getElementById('manualStudentEmail');
    const email = emailInput?.value?.trim();
    if (!email) {
      window.toast?.show("Email manzilini kiriting", "warning");
      return;
    }
    try {
      await API.post(`/courses/${this.course.slug}/enrolled-students/`, { email });
      window.toast?.show("O'quvchi qo'shildi", 'success');
      emailInput.value = '';
      this.loadEnrolledStudents();
    } catch (e) {
      window.toast?.show(e.message || "Xatolik yuz berdi", 'error');
    }
  },

  selectCourseType(type) {
    const isPrivate = (type === 'private');
    document.getElementById('isPrivate').checked = isPrivate;

    const publicCard = document.getElementById('publicTypeCard');
    const publicCheck = document.getElementById('publicRadioCheck');
    const privateCard = document.getElementById('privateTypeCard');
    const privateCheck = document.getElementById('privateRadioCheck');

    if (isPrivate) {
      publicCard.style.borderColor = '#D1D5DB';
      publicCard.style.background = 'white';
      publicCard.style.color = 'var(--ink)';
      publicCheck.textContent = '○';
      publicCheck.style.color = '#D1D5DB';

      privateCard.style.borderColor = 'var(--primary)';
      privateCard.style.background = 'var(--primary-light)';
      privateCard.style.color = 'var(--primary)';
      privateCheck.textContent = '✓';
      privateCheck.style.color = 'var(--primary)';

      document.getElementById('privateSettingsFields').style.display = 'flex';
      document.getElementById('publicHelpInfo').style.display = 'none';

      const btnAction = document.getElementById('btnStep4Action');
      if (btnAction) {
        btnAction.innerHTML = `O'QUVCHILAR <i class="ti ti-arrow-right"></i>`;
      }
    } else {
      publicCard.style.borderColor = 'var(--primary)';
      publicCard.style.background = 'var(--primary-light)';
      publicCard.style.color = 'var(--primary)';
      publicCheck.textContent = '✓';
      publicCheck.style.color = 'var(--primary)';

      privateCard.style.borderColor = '#D1D5DB';
      privateCard.style.background = 'white';
      privateCard.style.color = 'var(--ink)';
      privateCheck.textContent = '○';
      privateCheck.style.color = '#D1D5DB';

      document.getElementById('privateSettingsFields').style.display = 'none';
      document.getElementById('publicHelpInfo').style.display = 'block';

      const btnAction = document.getElementById('btnStep4Action');
      if (btnAction) {
        btnAction.innerHTML = `NASHR ETISH <i class="ti ti-arrow-right"></i>`;
      }
    }

    this.handlePrivacyToggle();
  },

  handlePrivacyToggle() {
    const isPrivate = document.getElementById('isPrivate').checked;
    const requireApproval = document.getElementById('requireApproval');
    const enrollmentLimit = document.getElementById('enrollmentLimit');

    const step5Tab = document.getElementById('step5-tab');
    const step5Line = document.getElementById('step5-line');
    const btnGoToStep5 = document.getElementById('btnGoToStep5');

    if (!isPrivate) {
      requireApproval.checked = false;
      requireApproval.disabled = true;
      enrollmentLimit.value = '';
      enrollmentLimit.disabled = true;

      if (step5Tab) step5Tab.style.display = 'none';
      if (step5Line) step5Line.style.display = 'none';
      if (btnGoToStep5) btnGoToStep5.style.display = 'none';
    } else {
      requireApproval.disabled = false;
      enrollmentLimit.disabled = false;

      if (step5Tab) step5Tab.style.display = 'flex';
      if (step5Line) step5Line.style.display = 'block';
      if (btnGoToStep5) btnGoToStep5.style.display = 'inline-block';
      
      this.handleApprovalToggle();
    }
  },

  handleApprovalToggle() {
    const requireApprovalCheckbox = document.getElementById('requireApproval');
    const requireApproval = requireApprovalCheckbox.checked;
    const wrap = requireApprovalCheckbox.closest('.switch-wrap');

    if (wrap) {
      if (requireApproval) {
        wrap.style.borderColor = 'var(--primary)';
        wrap.style.background = 'var(--primary-light)';
        wrap.style.color = 'var(--primary)';
      } else {
        wrap.style.borderColor = '#D1D5DB';
        wrap.style.background = 'white';
        wrap.style.color = 'var(--ink)';
      }
    }

    const manualAddSection = document.querySelector('#step5 div[style*="background:var(--surface)"]');
    if (manualAddSection) {
      if (requireApproval) {
        manualAddSection.style.display = 'block';
      } else {
        manualAddSection.style.display = 'none';
      }
    }
  },
};

window.CreateCourse = CreateCourse;

document.addEventListener('DOMContentLoaded', () => CreateCourse.init());
