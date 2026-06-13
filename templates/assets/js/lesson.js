// lesson.js — video, matn va quiz tizimini boshqaruvchi premium LMS o'yinchi
const LessonPage = {
  course: null,
  lesson: null,
  allLessons: [],
  player: null,
  ytPlayer: null,

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

  getLessonId() {
    return new URLSearchParams(window.location.search).get('id');
  },

  async init() {
    if (!App.requireAuth()) return;

    const id = this.getLessonId();
    if (!id) {
      window.toast?.show('Dars topilmadi', 'error');
      return;
    }

    this.initTabs();

    try {
      await this.loadLesson(id);
    } catch (e) {
      if (e.status === 403) {
        const slug = new URLSearchParams(window.location.search).get('slug')
          || sessionStorage.getItem('lesson_course_slug');
        if (slug) {
          try {
            await API.post(`/courses/${slug}/enroll/`);
            await this.loadLesson(id);
            return;
          } catch (enrollErr) {
            if (!enrollErr.message?.includes('allaqachon')) {
              window.toast?.show(enrollErr.message, 'error');
            } else {
              try { await this.loadLesson(id); return; } catch {}
            }
          }
        }
        window.toast?.show("Avval kursga yoziling.", 'error');
        setTimeout(() => {
          window.location.href = slug ? `/course-detail.html?slug=${slug}` : '/courses.html';
        }, 1500);
        return;
      }
      window.toast?.show(e.message, 'error');
    }
  },

  initTabs() {
    document.querySelectorAll('.tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (tab.classList.contains('disabled')) return;
        
        document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const targetTab = tab.dataset.tab;
        document.querySelectorAll('.tab-pane').forEach(pane => {
          pane.style.display = 'none';
        });
        
        const pane = document.getElementById(`${targetTab}Tab`);
        if (pane) pane.style.display = 'block';
      });
    });
  },

  async loadLesson(id) {
    const result = await API.get(`/courses/lessons/${id}/`);
    this.lesson = result.data;
    await this.loadCourseContext();
    this.render();
  },

  async loadCourseContext() {
    const courseSlug = new URLSearchParams(window.location.search).get('slug')
      || sessionStorage.getItem('lesson_course_slug');

    if (!courseSlug) return;

    const res = await API.get(`/courses/${courseSlug}/`);
    this.course = res.data;
    sessionStorage.setItem('lesson_course_slug', courseSlug);
    this.allLessons = [];
    (this.course.modules || []).forEach((mod) => {
      (mod.lessons || []).forEach((l) => this.allLessons.push({ ...l, moduleTitle: mod.title }));
    });
  },

  render() {
    const l = this.lesson;
    document.title = `${l.title} | MUTP`;

    const navTitle = document.querySelector('.lesson-title-nav');
    if (navTitle && this.course) navTitle.textContent = this.course.title;

    const backBtn = document.querySelector('.back-btn');
    if (backBtn && this.course) {
      backBtn.href = `/course-detail.html?slug=${this.course.slug}`;
    }

    const titleEl = document.querySelector('.lesson-title-lg');
    if (titleEl) titleEl.textContent = l.title;

    const descriptionContent = document.querySelector('#descriptionTab .tab-content');
    if (descriptionContent) {
      if (l.lesson_type === 'text') {
        descriptionContent.innerHTML = l.text_content
          ? `<div>${marked.parse(l.text_content)}</div>`
          : (l.content ? `<div>${l.content.replace(/\n/g, '<br>')}</div>` : '<p>Matn dars mazmuni mavjud emas.</p>');
      } else {
        descriptionContent.innerHTML = l.content
          ? `<div>${l.content.replace(/\n/g, '<br>')}</div>`
          : '<p>Dars tavsifi mavjud emas.</p>';
      }
    }

    // Reset tabs to description on load
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
    const descTabHeader = document.querySelector('.tabs .tab[data-tab="description"]');
    if (descTabHeader) descTabHeader.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
    const descTabPane = document.getElementById('descriptionTab');
    if (descTabPane) descTabPane.style.display = 'block';

    // Render resources and quiz
    this.renderResources(l);
    this.renderQuizUI(l);

    // Player va Bannerlarni render qilish
    this.renderLessonPlayer(l);

    if (this.course) {
      const progressFill = document.querySelector('.course-progress-fill');
      const progressText = document.querySelector('.course-progress-text span:last-child');
      const enrolled = this.course.is_enrolled;
      if (progressFill && enrolled) {
        let completedLessonsCount = 0;
        let totalLessonsCount = 0;
        this.allLessons.forEach(les => {
          totalLessonsCount++;
          if (les.is_completed) completedLessonsCount++;
        });
        const calcPct = totalLessonsCount > 0 ? (completedLessonsCount / totalLessonsCount) * 100 : 0;
        
        progressFill.style.width = `${calcPct}%`;
        if (progressText) progressText.textContent = `${Math.round(calcPct)}%`;
      }
    }

    this.renderSidebar();
    App.updateNav();
    this.checkLessonHomeworks();
    
    // Next lesson configurations
    const next = this.getNextLesson();
    const nextBtn = document.getElementById('nextBtn');
    if (next && nextBtn) {
      nextBtn.onclick = () => {
        window.location.href = `/lesson.html?id=${next.id}&slug=${this.course?.slug || ''}`;
      };
    }
  },

  renderLessonPlayer(lesson) {
    const videoEl = document.getElementById('videoPlayer');
    const ytContainer = document.getElementById('ytPlayerContainer');
    const textContainer = document.getElementById('textLessonContainer');
    const quizContainer = document.getElementById('quizContainer');
    const nextBtn = document.getElementById('nextBtn');

    if (videoEl) videoEl.style.display = 'none';
    if (ytContainer) ytContainer.style.display = 'none';
    if (textContainer) textContainer.style.display = 'none';
    if (quizContainer) quizContainer.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';

    const prevControls = document.querySelector('.player-controls');
    if (prevControls) prevControls.remove();

    if (lesson.lesson_type === 'video') {
      let src = lesson.video_file || lesson.video_url;
      if (src) {
        if (this.isYouTubeUrl(src)) {
          this.initYouTube(src);
        } else {
          src = this.getMediaUrl(src);
          if (videoEl) {
            videoEl.style.display = 'block';
            videoEl.src = src;
            videoEl.removeAttribute('controls');
            this.initPlayer();
          }
        }
      } else {
        if (ytContainer) {
          ytContainer.style.display = 'block';
          ytContainer.innerHTML = `
            <div class="empty-lesson-banner" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; width:100%; height:100%; aspect-ratio:16/9; background:#000; color:var(--muted);">
              <span style="font-size:48px;">🎬</span>
              <p>Bu darsga hali video yuklanmagan.</p>
            </div>`;
        }
      }
    } else if (lesson.lesson_type === 'text') {
      if (textContainer) {
        textContainer.style.display = 'flex';
        const completeBtn = document.getElementById('completeTextBtn');
        const isDone = lesson.current_progress?.is_completed;
        
        if (isDone) {
          completeBtn.innerHTML = '<i class="ti ti-circle-check"></i> Tugatilgan';
          completeBtn.style.background = 'var(--muted)';
          completeBtn.style.boxShadow = 'none';
          completeBtn.disabled = true;
          if (nextBtn) nextBtn.style.display = 'flex';
        } else {
          completeBtn.innerHTML = '<i class="ti ti-checkbox"></i> Darsni tugatdim';
          completeBtn.style.background = 'var(--duo-green)';
          completeBtn.style.boxShadow = '0 4px 0 var(--duo-green-dark)';
          completeBtn.disabled = false;
          completeBtn.onclick = () => this.completeLessonProgress(true);
        }
      }
    } else if (lesson.lesson_type === 'quiz') {
      if (textContainer) {
        textContainer.style.display = 'flex';
        textContainer.innerHTML = `
          <i class="ti ti-help" style="font-size: 80px; color: var(--duo-green); margin-bottom: 20px;"></i>
          <h2 style="font-family:'Plus Jakarta Sans';">Dars Testi</h2>
          <p style="margin-top: 10px; opacity:0.8; max-width: 500px;">Ushbu dars testdan iborat. Darsni tamomlash uchun pastdagi "Uyga vazifa" tabiga o'tib savollarga javob bering.</p>
        `;
      }
    } else if (lesson.lesson_type === 'homework') {
      if (textContainer) {
        textContainer.style.display = 'flex';
        const isDone = lesson.current_progress?.is_completed;
        textContainer.innerHTML = `
          <div class="homework-banner">
            <span style="font-size:48px;">📝</span>
            <h3 style="font-family:'Plus Jakarta Sans'; margin: 8px 0;">${lesson.title}</h3>
            <p style="font-size: 14px; opacity:0.9; max-width: 500px; margin-bottom: 12px;">${lesson.homework_description || "Vazifa tasviri kiritilmagan."}</p>
            ${lesson.homework_deadline_days ? `<span class="deadline-badge">⏰ ${lesson.homework_deadline_days} kun ichida</span>` : ''}
            <div style="margin-top: 12px;">
              <button id="markHomeworkDone" class="btn" style="background:${isDone ? 'var(--muted)' : 'var(--duo-green)'}; border:none; color:white; padding:12px 24px; border-radius:16px; font-weight:700; cursor:${isDone ? 'default' : 'pointer'}; box-shadow:${isDone ? 'none' : '0 4px 0 var(--duo-green-dark)'};" ${isDone ? 'disabled' : ''}>
                ${isDone ? 'Vazifa bajarildi ✓' : 'Vazifani bajardim ✓'}
              </button>
            </div>
          </div>`;
        
        if (!isDone) {
          document.getElementById('markHomeworkDone').onclick = () => this.completeLessonProgress(true);
        } else {
          if (nextBtn) nextBtn.style.display = 'flex';
        }
      }
    }
  },

  isYouTubeUrl(url) {
    return url.includes('youtube.com') || url.includes('youtu.be');
  },

  getYouTubeEmbedUrl(url) {
    let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    let match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}?enablejsapi=1&rel=0`;
    }
    return null;
  },

  initYouTube(url) {
    const container = document.getElementById('ytPlayerContainer');
    if (!container) return;
    container.style.display = 'block';
    
    const embedUrl = this.getYouTubeEmbedUrl(url);
    if (!embedUrl) {
      container.innerHTML = '<p style="color:white;padding:40px;text-align:center;">Noto\'g\'ri YouTube havolasi</p>';
      return;
    }

    container.innerHTML = `
      <iframe id="ytPlayer" width="100%" height="100%" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    `;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    const self = this;
    const triggerYTInit = () => {
      new YT.Player('ytPlayer', {
        events: {
          'onStateChange': function(event) {
            if (event.data === YT.PlayerState.ENDED) {
              self.completeLessonProgress(true); // video tugaganda progressni saqlash
            }
          }
        }
      });
    };

    window.onYouTubeIframeAPIReady = triggerYTInit;
    if (window.YT && window.YT.Player) {
      triggerYTInit();
    }
    
    // YouTube videoni yuklaganidan keyin tugmani ko'rsatish
    setTimeout(() => {
      const nextBtn = document.getElementById('nextBtn');
      if (nextBtn) nextBtn.style.display = 'flex';
    }, 5000);
  },

  async completeLessonProgress(isCompleted = false, silent = false) {
    try {
      await API.patch(`/courses/lessons/${this.lesson.id}/progress/`, {
        watched_seconds: 1,
        is_completed: isCompleted
      });
      if (!silent) {
        window.toast?.show("Dars progressi muvaffaqiyatli saqlandi!", "success");
        await this.loadLesson(this.lesson.id);
      }
    } catch (e) {
      if (!silent) window.toast?.show(e.message, "error");
    }
  },

  renderResources(lesson) {
    const container = document.querySelector('.resources-tab-content');
    if (!container) return;

    if (!lesson.resources || lesson.resources.length === 0) {
      container.innerHTML = `<p class="empty-state">Bu darsga hali resurslar qo'shilmagan.</p>`;
      return;
    }

    container.innerHTML = lesson.resources.map(r => {
      const icon = r.resource_type === 'link' ? '🔗' : this.getFileIcon(r.title);
      const href = r.resource_type === 'link' ? r.url : r.file;
      const sizeLabel = r.file_size ? this.formatFileSize(r.file_size) : '';
      return `
        <a href="${href}" target="_blank" class="resource-item">
          <span class="resource-icon">${icon}</span>
          <div class="resource-info">
            <span class="resource-title">${r.title}</span>
            <span class="resource-meta">${r.resource_type === 'link' ? 'Havola' : sizeLabel}</span>
          </div>
          <span class="resource-download">⬇</span>
        </a>`;
    }).join('');
  },

  getFileIcon(filename) {
    if (!filename) return '📎';
    const ext = filename.split('.').pop().toLowerCase();
    const map = { pdf: '📄', doc: '📝', docx: '📝', ppt: '📊', pptx: '📊', zip: '🗂️', jpg: '🖼️', png: '🖼️' };
    return map[ext] || '📎';
  },

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/1024/1024).toFixed(1) + ' MB';
  },

  renderQuizUI(lesson) {
    const container = document.querySelector('.homework-tab-content');
    if (!container) return;

    if (!lesson.questions || lesson.questions.length === 0) {
      container.innerHTML = `<p class="empty-state">Bu darsga uyga vazifa biriktirilmagan.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="quiz-wrapper">
        <h3 style="color: var(--ink); margin-bottom: 8px;">📝 Uyga vazifa — ${lesson.questions.length} savol</h3>
        <p class="quiz-pass-note" style="color: var(--muted); font-size:13px; margin-bottom: 16px;">O'tish balli: 70%</p>
        <div id="quizQuestionsList"></div>
        <button id="submitQuizBtn" class="btn" style="background:var(--duo-green); border:none; color:white; padding:12px 24px; border-radius:16px; font-weight:700; cursor:pointer; box-shadow: 0 4px 0 var(--duo-green-dark); font-size:15px; margin-top: 12px; display: block; width: 100%; transition: transform 0.1s;">Tekshirish</button>
        <div id="quizResultAlert" style="display:none; margin-top:16px;"></div>
      </div>`;

    const qList = document.getElementById('quizQuestionsList');
    lesson.questions.forEach((q, idx) => {
      const qDiv = document.createElement('div');
      qDiv.className = 'quiz-question';
      qDiv.innerHTML = `
        <p class="quiz-q-text">${idx+1}. ${q.text}</p>
        <div class="quiz-options">
          ${q.options.map(opt => `
            <label class="quiz-option">
              <input type="radio" name="q${q.id}" value="${opt.id}">
              <span style="color: var(--ink-2); font-size: 14px;">${opt.text}</span>
            </label>`).join('')}
        </div>`;
      qList.appendChild(qDiv);
    });

    document.getElementById('submitQuizBtn').onclick = async () => {
      const answers = lesson.questions.map(q => {
        const selected = document.querySelector(`input[name="q${q.id}"]:checked`);
        return { question_id: q.id, answer_id: selected ? parseInt(selected.value) : null };
      });

      const unanswered = answers.filter(a => a.answer_id === null);
      if (unanswered.length > 0 && !confirm("Barcha savollarga javob bermadingiz. Baribir tekshirasizmi?")) {
        return;
      }

      const submitBtn = document.getElementById('submitQuizBtn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Hisoblanmoqda...';

      try {
        const res = await API.post(`/courses/lessons/${lesson.id}/quiz/submit/`, { answers });
        const resultDiv = document.getElementById('quizResultAlert');
        resultDiv.style.display = 'block';
        
        const passed = res.data.is_passed ?? res.data.passed;
        const score = res.data.score;
        
        resultDiv.innerHTML = `
          <div class="quiz-score ${passed ? 'passed' : 'failed'}">
            Natija: ${score}% — ${passed ? "O'tdingiz! ✅" : "O'ta olmadingiz ❌"}
          </div>
          <button id="retryQuizBtn" class="btn" style="background:var(--ink); border:none; color:white; padding:10px 20px; border-radius:12px; font-weight:600; cursor:pointer; margin-top:12px; display:block; width:100%;">Qayta urinish</button>`;
        
        document.getElementById('retryQuizBtn').onclick = () => this.renderQuizUI(lesson);
        
        if (passed) {
          window.toast?.show("Tabriklaymiz! Testdan muvaffaqiyatli o'tdingiz.", "success");
          await this.loadLesson(lesson.id);
        } else {
          window.toast?.show("Afsuski, o'tish ballini to'play olmadingiz.", "error");
        }
      } catch (err) {
        window.toast?.show(err.message || "Test topshirishda xatolik", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Tekshirish';
      }
    };
  },

  renderSidebar() {
    const container = document.querySelector('.sidebar-content');
    if (!container || !this.course?.modules) return;

    container.innerHTML = this.course.modules.map((mod) => `
      <div class="section-group">
        <div class="section-title">${mod.title}</div>
        <ul class="section-list">
          ${(mod.lessons || []).map((lesson) => {
            const active = this.lesson ? lesson.id === this.lesson.id : false;
            const done = lesson.is_completed;
            const icon = done ? 'ti-circle-check-filled icon-done' : active ? 'ti-player-play-filled icon-play' : 'ti-circle icon-lock';
            return `
              <li class="s-lesson ${active ? 'active' : ''}" data-lesson-id="${lesson.id}" onclick="window.location.href='/lesson.html?id=${lesson.id}&slug=${this.course.slug}'">
                <i class="ti ${icon} icon"></i>
                ${lesson.title}
                <div style="font-size:11px;color:var(--muted);margin-top:2px;">${lesson.duration_display || ''}</div>
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    `).join('');
  },

  initPlayer() {
    const videoEl = document.getElementById('videoPlayer');
    if (!videoEl || !videoEl.src) return;

    const nextBtn = document.getElementById('nextBtn');
    const lastWatched = this.lesson.current_progress?.watched_seconds || 0;
    let lastSaved = lastWatched;

    this.player = new EduPlayer(videoEl, {
      lastWatched,
      onProgress: async (time) => {
        if (Math.abs(time - lastSaved) < 5) return;
        lastSaved = time;
        try {
          await API.patch(`/courses/lessons/${this.lesson.id}/progress/`, {
            watched_seconds: Math.floor(time),
          });
        } catch {
          // silent
        }
      },
      onComplete: async () => {
        if (nextBtn) nextBtn.style.display = 'flex';
        await this.completeLessonProgress(true);
      },
    });
  },

  getNextLesson() {
    if (!this.lesson) return null;
    const idx = this.allLessons.findIndex((l) => l.id === this.lesson?.id);
    return idx >= 0 && idx < this.allLessons.length - 1 ? this.allLessons[idx + 1] : null;
  },

  async checkLessonHomeworks() {
    const isCompleted = this.lesson?.current_progress?.is_completed;
    if (!isCompleted || !this.course?.slug) return;

    try {
      const res = await API.get(`/courses/teacher/courses/${this.course.slug}/homeworks/`);
      const homeworks = res.data?.data || [];
      const lessonHw = homeworks.filter(hw => hw.after_lesson === this.lesson?.id && hw.submission_status === 'pending');
      
      const oldBanner = document.getElementById('lessonHwBanner');
      if (oldBanner) oldBanner.remove();

      if (lessonHw.length > 0) {
        const banner = document.createElement('div');
        banner.id = 'lessonHwBanner';
        banner.className = 'homework-popup-banner';
        banner.style.cssText = `
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--amber-light);
          border: 1px solid var(--amber);
          border-radius: 10px;
          padding: 12px 16px;
          margin-top: 16px;
          font-size: 14px;
        `;
        banner.innerHTML = `
          📝 Sizga yangi vazifa berildi: <strong>${lessonHw[0].title}</strong>
          <a href="/course-detail.html?slug=${this.course.slug}#homeworks" style="margin-left:auto; color:var(--ink); font-weight:700; text-decoration:none;">Ko'rish &rarr;</a>
        `;
        
        const parent = document.querySelector('#descriptionTab') || document.body;
        parent.insertBefore(banner, parent.firstChild);
      }
    } catch(e) {}
  },
};

document.addEventListener('DOMContentLoaded', () => LessonPage.init());
