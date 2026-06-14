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
      const spinner = document.getElementById('loadingSpinner');
      if (spinner) spinner.style.display = 'none';
      document.querySelectorAll('.lesson-nav, .lesson-layout').forEach(el => el.classList.add('loaded-state'));
      window.toast?.show(e.message, 'error');
    }
  },

  initTabs() {
    document.querySelectorAll('.lesson-tabs .tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        if (tab.classList.contains('disabled')) return;
        
        document.querySelectorAll('.lesson-tabs .tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const targetTab = tab.dataset.tab;
        document.querySelectorAll('.tab-pane').forEach(pane => {
          pane.style.display = 'none';
        });
        
        const paneId = targetTab === 'description' ? 'descriptionTab' : `tab-${targetTab}`;
        const pane = document.getElementById(paneId);
        if (pane) pane.style.display = 'block';

        if (targetTab === 'discussion') {
          LessonPage.loadDiscussions();
        }
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
          ? `<div>${App.markdown(l.text_content)}</div>`
          : (l.content ? `<div>${l.content.replace(/\n/g, '<br>')}</div>` : '<p>Matn dars mazmuni mavjud emas.</p>');
      } else {
        descriptionContent.innerHTML = l.content
          ? `<div>${l.content.replace(/\n/g, '<br>')}</div>`
          : '<p>Dars tavsifi mavjud emas.</p>';
      }
    }

    // Reset tabs to description on load
    document.querySelectorAll('.lesson-tabs .tab-btn').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');

    // Auto-switch to quiz/homework tab for quiz lessons
    if (l.lesson_type === 'quiz') {
      const hwTabHeader = document.querySelector('.lesson-tabs .tab-btn[data-tab="homework"]');
      if (hwTabHeader) hwTabHeader.classList.add('active');
      const hwTabPane = document.getElementById('tab-homework');
      if (hwTabPane) hwTabPane.style.display = 'block';
    } else {
      const descTabHeader = document.querySelector('.lesson-tabs .tab-btn[data-tab="description"]');
      if (descTabHeader) descTabHeader.classList.add('active');
      const descTabPane = document.getElementById('descriptionTab');
      if (descTabPane) descTabPane.style.display = 'block';
    }

    // Render resources and quiz
    this.renderResources(l);
    this.renderHomeworkTab(l);


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

    // Unhide content and hide spinner
    document.querySelectorAll('.lesson-nav, .lesson-layout').forEach(el => el.classList.add('loaded-state'));
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'none';
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
    let lastSaved = this.lesson.current_progress?.watched_seconds || 0;

    const triggerYTInit = () => {
      self.ytPlayer = new YT.Player('ytPlayer', {
        events: {
          'onReady': function(e) {
            if (lastSaved > 0) {
              e.target.seekTo(lastSaved, true);
            }
          },
          'onStateChange': function(event) {
            if (event.data === YT.PlayerState.ENDED) {
              self.completeLessonProgress(true);
              clearInterval(self.ytPollInterval);
            } else if (event.data === YT.PlayerState.PLAYING) {
              clearInterval(self.ytPollInterval);
              self.ytPollInterval = setInterval(async () => {
                try {
                  const time = self.ytPlayer.getCurrentTime();
                  if (time && Math.abs(time - lastSaved) >= 5) {
                    lastSaved = time;
                    await API.patch(`/courses/lessons/${self.lesson.id}/progress/`, {
                      watched_seconds: Math.floor(time)
                    });
                  }
                } catch (e) {}
              }, 5000);
            } else {
              clearInterval(self.ytPollInterval);
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
    const container = document.querySelector('#tab-resources');
    if (!container) return;

    if (!lesson.resources || lesson.resources.length === 0) {
      container.innerHTML = `<div class="empty-state">📎 Bu darsga resurslar qo'shilmagan.</div>`;
      return;
    }

    container.innerHTML = lesson.resources.map(r => {
      const href = r.resource_type === 'link' ? r.url : r.file;
      return `
        <a href="${href}" target="_blank" class="resource-row">
          <span class="resource-row-icon">${r.resource_type === 'link' ? '🔗' : this.getFileIcon(r.title)}</span>
          <div class="resource-row-info">
            <span class="resource-row-title">${r.title}</span>
            <span class="resource-row-meta">${r.resource_type === 'link' ? 'Havola' : this.formatFileSize(r.file_size)}</span>
          </div>
          <span class="resource-row-dl">⬇</span>
        </a>`;
    }).join('');
  },

  getFileIcon(title) {
    if (!title) return '📎';
    const ext = title.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return '📕';
    if (['doc', 'docx'].includes(ext)) return '📘';
    if (['xls', 'xlsx'].includes(ext)) return '📗';
    if (['zip', 'rar'].includes(ext)) return '📦';
    if (['png', 'jpg', 'jpeg', 'svg'].includes(ext)) return '🖼️';
    return '📎';
  },

  formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },

  renderHomeworkTab(lesson) {
    const container = document.querySelector('#tab-homework');
    if (!container) return;

    API.get(`/courses/lessons/${lesson.id}/homeworks/`).then(res => {
      const homeworks = res.data.results || res.data;
      if (!homeworks?.length) {
        container.innerHTML = `<div class="empty-state">📋 Bu darsga uyga vazifa biriktirilmagan.</div>`;
        return;
      }
      container.innerHTML = homeworks.map(hw => {
        // Holat aniqlash
        const status = hw.my_submission?.status;
        const score = hw.my_submission?.teacher_score;
        let statusBadge = '';
        let actionBtn = '';

        if (!status || status === 'pending') {
          // Topshirilmagan
          statusBadge = `<span class="hw-badge pending">❌ Topshirilmagan</span>`;
          actionBtn = `<a href="homework.html?id=${hw.id}" class="btn-hero">Boshlash →</a>`;
        } else if (status === 'submitted') {
          // Topshirilgan, ustoz tekshirmagan
          statusBadge = `<span class="hw-badge waiting">⏳ Tekshirilmoqda</span>`;
          actionBtn = `<a href="homework.html?id=${hw.id}" class="btn-secondary" style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center;">Ko'rish</a>`;
        } else if (status === 'reviewed') {
          // Ustoz tekshirgan
          statusBadge = `<span class="hw-badge reviewed">✅ Tekshirildi — ${score}/100</span>`;
          actionBtn = `<a href="homework.html?id=${hw.id}" class="btn-primary" style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center;">Natijani ko'rish →</a>`;
        }

        return `
          <div class="hw-preview-card">
            <div class="hw-preview-icon">📝</div>
            <div class="hw-preview-info">
              <div class="hw-preview-title">${hw.title}</div>
              <div class="hw-preview-meta">
                ${hw.deadline_days ? `⏰ ${hw.deadline_days} kun muddat` : ''}
                ${statusBadge}
              </div>
              ${status === 'reviewed' && hw.my_submission?.feedback ? `
                <div class="hw-feedback-preview">
                  💬 Ustoz: "${hw.my_submission.feedback.substring(0, 80)}${hw.my_submission.feedback.length > 80 ? '...' : ''}"
                </div>` : ''}
            </div>
            ${actionBtn}
          </div>`;
      }).join('');
    });
  },



  renderSidebar() {
    const sidebar = document.querySelector('.lesson-sidebar');
    if (!sidebar || !this.course) return;

    let html = `
      <div class="sidebar-header">
        <div class="sidebar-progress-bar-wrap">
          <div class="sidebar-progress-label"><span></span><span>${this.course.progress || 0}%</span></div>
          <div class="sidebar-progress-bar"><div class="sidebar-progress-fill" style="width:${this.course.progress || 0}%"></div></div>
        </div>
      </div>
      <div class="sidebar-content">`;

    (this.course.modules || []).forEach(module => {
      html += `<div class="sidebar-module">
        <div class="sidebar-module-title">${module.title}</div>`;
      (module.lessons || []).forEach(lesson => {
        const isCurrent = this.lesson ? lesson.id === this.lesson.id : false;
        const statusIcon = lesson.is_completed ? '✓' : (isCurrent ? '▶' : '·');
        const statusClass = lesson.is_completed ? 'done' : (isCurrent ? 'current' : '');
        const duration = this.formatSidebarDuration(lesson.duration_seconds);
        html += `
          <div class="sidebar-lesson ${statusClass}" data-lesson-id="${lesson.id}"
               onclick="window.location.href='lesson.html?id=${lesson.id}&slug=${this.course.slug}'">
            <span class="sidebar-lesson-icon">${statusIcon}</span>
            <span class="sidebar-lesson-title">${lesson.title}</span>
            <span class="sidebar-lesson-duration">${duration}</span>
          </div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;

    sidebar.innerHTML = html;
  },

  formatSidebarDuration(seconds) {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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
    if (!this.course?.slug) return;

    try {
      const res = await API.get(`/courses/${this.course.slug}/homeworks/`);
      const homeworks = res.data || [];
      const lessonHw = homeworks.filter(hw =>
        hw.after_lesson === this.lesson?.id && hw.submission_status === 'pending'
      );
      
      const oldBanner = document.getElementById('lessonHwBanner');
      if (oldBanner) oldBanner.remove();

      if (lessonHw.length > 0) {
        const banner = document.createElement('div');
        banner.id = 'lessonHwBanner';
        banner.style.cssText = `
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--amber-light, #fffbeb);
          border: 1px solid var(--amber, #f59e0b);
          border-radius: 10px;
          padding: 12px 16px;
          margin-bottom: 16px;
          font-size: 14px;
        `;
        banner.innerHTML = `
          📝 Sizga yangi vazifa berildi: <strong>${lessonHw[0].title}</strong>
          <a href="/course-detail.html?slug=${this.course.slug}" style="margin-left:auto; color:var(--ink); font-weight:700; text-decoration:none;">Ko'rish &rarr;</a>
        `;
        
        const parent = document.querySelector('#descriptionTab') || document.body;
        parent.insertBefore(banner, parent.firstChild);
      }
    } catch(e) { /* silent — student may not have access */ }
  },

  capturedTimestampSeconds: null,

  showQuestionForm() {
    document.getElementById('newQuestionForm').style.display = 'block';
    this.capturedTimestampSeconds = null;
    document.getElementById('captureTimeText').textContent = '';
  },

  hideQuestionForm() {
    document.getElementById('newQuestionForm').style.display = 'none';
  },

  captureTimestamp() {
    let seconds = 0;
    try {
      if (this.player && this.player.video) {
        seconds = Math.floor(this.player.video.currentTime);
      } else if (this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        seconds = Math.floor(this.ytPlayer.getCurrentTime());
      } else {
        const videoEl = document.getElementById('videoPlayer');
        if (videoEl) seconds = Math.floor(videoEl.currentTime);
      }
    } catch (e) {
      console.error("Video vaqtini olishda xato:", e);
    }

    if (seconds > 0) {
      this.capturedTimestampSeconds = seconds;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      document.getElementById('captureTimeText').textContent = `[📍 ${mins}:${secs < 10 ? '0' : ''}${secs}]`;
    } else {
      window.toast?.show("Hozircha video o'ynatilmayapti", 'info');
    }
  },

  async submitQuestion() {
    const text = document.getElementById('qText').value.trim();
    const title = document.getElementById('qTitle').value.trim();
    if (!text) {
      window.toast?.show("Savol matnini kiriting", 'error');
      return;
    }

    try {
      await API.post(`/courses/lessons/${this.lesson.id}/discussions/`, {
        title: title || "Savol",
        text,
        video_timestamp: this.capturedTimestampSeconds
      });
      document.getElementById('qText').value = '';
      document.getElementById('qTitle').value = '';
      this.hideQuestionForm();
      window.toast?.show("Savol yuborildi", 'success');
      await this.loadDiscussions();
    } catch (e) {
      window.toast?.show(e.message || 'Xatolik', 'error');
    }
  },

  formatTime(totalSeconds) {
    if (!totalSeconds) return '';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  },

  seekToTime(seconds) {
    try {
      if (this.player && this.player.video) {
        this.player.video.currentTime = seconds;
        this.player.video.play();
      } else if (this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
        this.ytPlayer.seekTo(seconds, true);
      } else {
        const videoEl = document.getElementById('videoPlayer');
        if (videoEl) {
          videoEl.currentTime = seconds;
          videoEl.play();
        }
      }
    } catch (e) {
      console.error("Videoni seek qilishda xato:", e);
    }
  },

  async loadDiscussions() {
    const listEl = document.getElementById('discussionsList');
    try {
      const res = await API.get(`/courses/lessons/${this.lesson.id}/discussions/`);
      const discussions = res.data || [];
      if (discussions.length === 0) {
        listEl.innerHTML = '<div class="empty-state">💬 Hali hech kim savol yozmagan. Birinchi bo\'lib savol bering!</div>';
        return;
      }

      listEl.innerHTML = discussions.map(d => {
        const isOwner = d.author === this.currentUser?.id;
        const isTeacher = this.currentUser?.role === 'teacher';
        const replies = d.replies || [];

        // Build reactions HTML
        let reactionsHtml = '';
        const emojis = ['👍', '❤️', '😂'];
        emojis.forEach(emoji => {
          const reactors = d.reactions[emoji] || [];
          const hasReacted = reactors.some(r => r.user_id === this.currentUser?.id);
          reactionsHtml += `
            <button onclick="LessonPage.toggleReact(${d.id}, '${emoji}', 'discussion')" style="padding:4px 8px; border-radius:6px; border:1px solid ${hasReacted ? 'var(--purple)' : 'var(--border)'}; background:${hasReacted ? 'var(--purple-light)' : 'white'}; cursor:pointer; font-size:12px; margin-right:6px;">
              ${emoji} ${reactors.length || ''}
            </button>`;
        });

        // Build replies list HTML
        const repliesListHtml = replies.map(r => {
          const isReplyAccepted = r.is_accepted;
          let replyReacts = '';
          emojis.forEach(emoji => {
            const reactors = (r.reactions || {})[emoji] || [];
            const hasReacted = reactors.some(reactor => reactor.user_id === this.currentUser?.id);
            replyReacts += `
              <button onclick="LessonPage.toggleReact(${r.id}, '${emoji}', 'reply')" style="padding:2px 6px; border-radius:6px; border:1px solid ${hasReacted ? 'var(--purple)' : 'var(--border)'}; background:${hasReacted ? 'var(--purple-light)' : 'white'}; cursor:pointer; font-size:11px; margin-right:4px;">
                ${emoji} ${reactors.length || ''}
              </button>`;
          });

          return `
            <div style="padding:10px 0; border-top:1px solid var(--border); margin-top:8px; display:flex; gap:10px; align-items:flex-start;">
              <div style="width:24px; height:24px; border-radius:50%; background:var(--purple-light); color:var(--purple); display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700;">
                ${r.author_name ? r.author_name[0] : '?'}
              </div>
              <div style="flex:1;">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                  <span style="font-size:12px; font-weight:700; color:var(--text);">${r.author_name} ${r.author_role === 'teacher' ? '<span style="color:var(--purple); font-size:10px;">(Ustoz)</span>' : ''}</span>
                  <span style="font-size:10px; color:var(--text-3);">${new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <div style="font-size:12.5px; color:var(--text-2); margin-top:4px;">${App.markdown(r.text)}</div>
                <div style="margin-top:6px; display:flex; align-items:center; justify-content:space-between;">
                  <div>${replyReacts}</div>
                  ${isTeacher ? `
                    <button onclick="LessonPage.toggleAcceptReply(${r.id})" style="border:none; background:transparent; color:${isReplyAccepted ? 'var(--green)' : 'var(--text-3)'}; font-size:11px; cursor:pointer; font-weight:700;">
                      ${isReplyAccepted ? '✅ To\'g\'ri javob' : '✔️ To\'g\'ri javob deb belgilash'}
                    </button>` : (isReplyAccepted ? '<span style="color:var(--green); font-size:11px; font-weight:700;">✅ To\'g\'ri javob</span>' : '')}
                </div>
              </div>
            </div>`;
        }).join('');

        return `
          <div class="discussion-item" style="background:white; border:2px solid ${d.is_pinned ? 'var(--purple)' : 'var(--border)'}; border-radius:16px; padding:16px; position:relative; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
            ${d.is_pinned ? '<span style="position:absolute; top:-10px; left:16px; background:var(--purple); color:white; font-size:10px; font-weight:700; padding:2px 8px; border-radius:20px;">📌 PINLANGAN</span>' : ''}
            
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div style="display:flex; gap:10px; align-items:center;">
                <div style="width:32px; height:32px; border-radius:50%; background:var(--purple-light); color:var(--purple); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">
                  ${d.author_name ? d.author_name[0] : '?'}
                </div>
                <div>
                  <div style="font-size:13px; font-weight:700; color:var(--text);">${d.author_name} ${d.author_role === 'teacher' ? '<span style="color:var(--purple); font-size:11px;">(Ustoz)</span>' : ''}</div>
                  <div style="font-size:10px; color:var(--text-3);">${new Date(d.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div style="display:flex; gap:6px;">
                ${isTeacher ? `
                  <button onclick="LessonPage.togglePin(${d.id})" class="btn-xs" style="background:transparent; border:none; color:var(--purple); cursor:pointer; font-size:12px;"><i class="ti ti-pin"></i> Pin</button>` : ''}
                ${(isTeacher || isOwner) ? `
                  <button onclick="LessonPage.toggleResolve(${d.id})" class="btn-xs" style="background:transparent; border:none; color:var(--green); cursor:pointer; font-size:12px;"><i class="ti ti-check"></i> ${d.is_resolved ? 'Hal bo\'ldi' : 'Hal qilish'}</button>` : ''}
              </div>
            </div>

            <!-- Content -->
            <div style="margin-top:12px;">
              <h4 style="font-size:14px; font-weight:700; color:var(--text);">${d.title || ''}</h4>
              <div style="font-size:13px; color:var(--text-2); margin-top:4px;">${App.markdown(d.text)}</div>
            </div>

            <div style="margin-top:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <div>
                ${d.video_timestamp ? `
                  <button onclick="LessonPage.seekToTime(${d.video_timestamp})" style="padding:4px 8px; border-radius:6px; border:none; background:var(--purple-light); color:var(--purple); font-weight:700; cursor:pointer; font-size:12px; margin-right:8px;">
                    ▶ ${this.formatTime(d.video_timestamp)} ga o't
                  </button>` : ''}
                ${reactionsHtml}
              </div>
              <span style="font-size:12px; color:var(--text-3); font-weight:600;">💬 ${replies.length} ta javob ${d.is_resolved ? '• ✅ Hal bo\'ldi' : ''}</span>
            </div>

            <!-- Replies Box -->
            <div style="margin-top:16px; background:#f9fafb; border-radius:12px; padding:12px;">
              <div id="replies-list-${d.id}">${repliesListHtml}</div>
              
              <!-- Reply input -->
              <div style="margin-top:10px; display:flex; gap:8px;">
                <input id="reply-input-${d.id}" type="text" placeholder="Javob yozish..." style="flex:1; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:12px; outline:none; background:white;">
                <button onclick="LessonPage.submitReply(${d.id})" style="padding:6px 12px; border-radius:8px; background:var(--purple); color:white; border:none; font-size:12px; font-weight:600; cursor:pointer;">Yuborish</button>
              </div>
            </div>
          </div>`;
      }).join('');

    } catch (e) {
      listEl.innerHTML = `<div class="empty-state">Yuklashda xato: ${e.message}</div>`;
    }
  },

  async submitReply(discId) {
    const input = document.getElementById(`reply-input-${discId}`);
    const text = input.value.trim();
    if (!text) return;

    try {
      await API.post(`/courses/discussions/${discId}/replies/`, { text });
      input.value = '';
      window.toast?.show("Javob qo'shildi", 'success');
      await this.loadDiscussions();
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  async toggleReact(id, emoji, targetType) {
    try {
      await API.post(`/courses/discussions/${id}/react/`, { emoji, target_type: targetType });
      await this.loadDiscussions();
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  async togglePin(discId) {
    try {
      await API.post(`/courses/discussions/${discId}/pin/`);
      await this.loadDiscussions();
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  async toggleResolve(discId) {
    try {
      await API.post(`/courses/discussions/${discId}/resolve/`);
      await this.loadDiscussions();
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  async toggleAcceptReply(replyId) {
    try {
      await API.post(`/courses/discussions/replies/${replyId}/accept/`);
      await this.loadDiscussions();
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

};

document.addEventListener('DOMContentLoaded', () => LessonPage.init());
