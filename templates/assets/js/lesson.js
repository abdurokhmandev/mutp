// lesson.js — video, matn va quiz tizimini boshqaruvchi premium LMS o'yinchi
const LessonPage = {
  course: null,
  lesson: null,
  allLessons: [],
  player: null,
  ytPlayer: null,
  
  // Quiz o'zgaruvchilari
  quizQuestions: [],
  currentQuestionIndex: 0,
  userAnswers: [],
  selectedOptionId: null,

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

    const contentEl = document.querySelector('.tab-content');
    if (contentEl) {
      contentEl.innerHTML = l.content
        ? `<div>${l.content.replace(/\n/g, '<br>')}</div>`
        : '<p>Dars tavsifi mavjud emas.</p>';
    }

    // Elementlarni tozalash/yashirish
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

    // Dars turi bo'yicha render
    if (l.lesson_type === 'video') {
      const src = l.video_file || l.video_url;
      if (src) {
        if (this.isYouTubeUrl(src)) {
          this.initYouTube(src);
        } else {
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
          ytContainer.innerHTML = '<p style="color:white;padding:40px;text-align:center;">Video hali yuklanmagan</p>';
        }
      }
    } else if (l.lesson_type === 'text') {
      if (textContainer) {
        textContainer.style.display = 'flex';
        const completeBtn = document.getElementById('completeTextBtn');
        const isDone = l.current_progress?.is_completed;
        
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
          completeBtn.onclick = () => this.completeTextLesson();
        }
      }
    } else if (l.lesson_type === 'quiz') {
      if (quizContainer) {
        quizContainer.style.display = 'flex';
        this.loadQuizQuestions();
      }
    }

    if (this.course) {
      const progressFill = document.querySelector('.course-progress-fill');
      const progressText = document.querySelector('.course-progress-text span:last-child');
      const enrolled = this.course.is_enrolled;
      if (progressFill && enrolled) {
        const pct = this.course.total_duration_seconds > 0 ? (l.current_progress?.course_progress ?? 0) : 0;
        // Agar o'quvchi kursga yozilgan bo'lsa va darslar tugatilgan bo'lsa
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
    
    // Keyingi dars tugmasini sozlash
    const next = this.getNextLesson();
    if (next && nextBtn) {
      nextBtn.onclick = () => {
        window.location.href = `/lesson.html?id=${next.id}&slug=${this.course?.slug || ''}`;
      };
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

    // YouTube API scriptini yuklash
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
              self.completeTextLesson(); // darsni yakunlash API ga yuboradi
            }
          }
        }
      });
    };

    window.onYouTubeIframeAPIReady = triggerYTInit;
    if (window.YT && window.YT.Player) {
      triggerYTInit();
    }
    
    // Qo'shimcha ravishda YouTube darslar uchun foydalanuvchi tugatganda yoki darhol "Keyingi" ni ochish uchun
    // 5 soniyadan so'ng auto complete yoki tugmani ochib qo'yish mumkin (video yakunlanmasa ham)
    setTimeout(() => {
      const nextBtn = document.getElementById('nextBtn');
      if (nextBtn) nextBtn.style.display = 'flex';
      this.completeTextLesson(true); // jim saqlash
    }, 15000);
  },

  async completeTextLesson(silent = false) {
    try {
      await API.patch(`/courses/lessons/${this.lesson.id}/progress/`, {
        watched_seconds: 1,
        is_completed: true
      });
      if (!silent) {
        window.toast?.show("Dars tugatildi!", "success");
        // reload current lesson state
        await this.loadLesson(this.lesson.id);
      }
    } catch (e) {
      if (!silent) window.toast?.show(e.message, "error");
    }
  },

  // Quiz interfeysi mantig'i
  async loadQuizQuestions() {
    try {
      const res = await API.get(`/courses/lessons/${this.lesson.id}/quiz/`);
      this.quizQuestions = res.data || [];
      this.currentQuestionIndex = 0;
      this.userAnswers = [];
      this.selectedOptionId = null;
      this.renderQuestion();
    } catch (e) {
      window.toast?.show("Quiz savollarini yuklab bo'lmadi.", "error");
    }
  },

  renderQuestion() {
    const container = document.getElementById('quizBody');
    const titleEl = document.getElementById('quizTitle');
    const progressEl = document.getElementById('quizProgress');
    const actionBtn = document.getElementById('quizActionBtn');
    
    if (this.quizQuestions.length === 0) {
      container.innerHTML = `<p style="text-align:center;padding:20px;">Bu darsda test savollari mavjud emas.</p>`;
      actionBtn.style.display = 'none';
      return;
    }

    actionBtn.style.display = 'block';

    if (this.currentQuestionIndex >= this.quizQuestions.length) {
      this.submitQuiz();
      return;
    }

    const q = this.quizQuestions[this.currentQuestionIndex];
    titleEl.textContent = this.lesson.title + " — Test";
    progressEl.textContent = `Savol: ${this.currentQuestionIndex + 1}/${this.quizQuestions.length}`;
    
    let optionsHtml = (q.options || []).map((opt, idx) => {
      const letter = String.fromCharCode(65 + idx); // A, B, C...
      return `
        <button class="quiz-option-card" data-id="${opt.id}" onclick="LessonPage.selectOption(${opt.id})">
          <div class="quiz-option-badge">${letter}</div>
          <span>${opt.text}</span>
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div class="quiz-question-text">${q.text}</div>
      <div class="quiz-options-list">
        ${optionsHtml}
      </div>
    `;

    actionBtn.textContent = this.currentQuestionIndex === this.quizQuestions.length - 1 ? "Natijani yuborish" : "Keyingi savol";
    actionBtn.onclick = () => this.nextQuestion();
    this.selectedOptionId = null;
    this.updateActionBtnState();
  },

  selectOption(id) {
    this.selectedOptionId = id;
    document.querySelectorAll('.quiz-option-card').forEach(card => {
      if (parseInt(card.dataset.id) === id) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
    this.updateActionBtnState();
  },

  updateActionBtnState() {
    const actionBtn = document.getElementById('quizActionBtn');
    if (this.selectedOptionId === null) {
      actionBtn.disabled = true;
      actionBtn.style.opacity = '0.5';
      actionBtn.style.cursor = 'not-allowed';
    } else {
      actionBtn.disabled = false;
      actionBtn.style.opacity = '1';
      actionBtn.style.cursor = 'pointer';
    }
  },

  nextQuestion() {
    if (this.selectedOptionId === null) return;
    const q = this.quizQuestions[this.currentQuestionIndex];
    this.userAnswers.push({
      question_id: q.id,
      selected_option_id: this.selectedOptionId
    });
    this.currentQuestionIndex++;
    this.renderQuestion();
  },

  async submitQuiz() {
    const container = document.getElementById('quizBody');
    const progressEl = document.getElementById('quizProgress');
    const actionBtn = document.getElementById('quizActionBtn');

    container.innerHTML = `<div style="text-align:center;padding:40px;"><i class="ti ti-loader" style="font-size:40px;animation:spin 1s infinite linear;display:inline-block;"></i><p style="margin-top:10px;">Natijalar hisoblanmoqda...</p></div>`;
    actionBtn.style.display = 'none';

    try {
      const res = await API.post(`/courses/lessons/${this.lesson.id}/quiz/submit/`, {
        answers: this.userAnswers
      });
      const attempt = res.data;
      
      const success = attempt.passed;
      const statusText = success ? "Tabriklaymiz! Testdan o'tdingiz!" : "Afsuski, yetarli ball to'play olmadingiz.";
      const color = success ? "var(--duo-green)" : "#ff4b4b";
      const icon = success ? "ti-circle-check-filled" : "ti-circle-x-filled";

      progressEl.textContent = `Natija: ${Math.round(attempt.score)}%`;

      container.innerHTML = `
        <div style="text-align:center; padding:20px;">
          <i class="ti ${icon}" style="font-size: 80px; color: ${color}; margin-bottom: 20px;"></i>
          <h2 style="font-family:'Plus Jakarta Sans'; color:${color};">${statusText}</h2>
          <p style="margin-top: 15px; font-size:16px;">Sizning natijangiz: <strong>${attempt.correct_count} / ${attempt.total_count}</strong> (${Math.round(attempt.score)}%)</p>
          <p style="margin-top: 10px; opacity: 0.8; font-size:14px;">O'tish bali: 70%</p>
          ${!success ? `
            <button onclick="LessonPage.loadQuizQuestions()" class="btn" style="background:#ff4b4b; border:none; color:white; padding:12px 24px; border-radius:16px; font-weight:700; cursor:pointer; box-shadow: 0 4px 0 #b33434; margin-top:20px; transition:transform 0.1s; display:inline-flex; align-items:center; gap:8px;">
              <i class="ti ti-refresh"></i> Qayta urinish
            </button>
          ` : ''}
        </div>
      `;

      if (success) {
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.style.display = 'flex';
        // Dars progressini yangilash
        await this.loadLesson(this.lesson.id);
      }
    } catch (e) {
      window.toast?.show("Natijalarni yuborishda xatolik yuz berdi.", "error");
      container.innerHTML = `
        <div style="text-align:center; padding:20px;">
          <i class="ti ti-circle-x-filled" style="font-size: 80px; color: #ff4b4b; margin-bottom: 20px;"></i>
          <h2>Xatolik yuz berdi</h2>
          <p style="margin-top: 10px;">${e.message || "Tizimda muammo."}</p>
          <button onclick="LessonPage.loadQuizQuestions()" class="btn" style="background:var(--duo-green); border:none; color:white; padding:12px 24px; border-radius:16px; font-weight:700; cursor:pointer; box-shadow: 0 4px 0 var(--duo-green-dark); margin-top:20px;">
            Qayta yuklash
          </button>
        </div>
      `;
    }
  },

  renderSidebar() {
    const container = document.querySelector('.sidebar-content');
    if (!container || !this.course?.modules) return;

    container.innerHTML = this.course.modules.map((mod) => `
      <div class="section-group">
        <div class="section-title">${mod.title}</div>
        <ul class="section-list">
          ${(mod.lessons || []).map((lesson) => {
            const active = lesson.id === this.lesson.id;
            const done = lesson.is_completed;
            const icon = done ? 'ti-circle-check-filled icon-done' : active ? 'ti-player-play-filled icon-play' : 'ti-circle icon-lock';
            return `
              <li class="s-lesson ${active ? 'active' : ''}" onclick="window.location.href='/lesson.html?id=${lesson.id}&slug=${this.course.slug}'">
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
          // jim
        }
      },
      onComplete: () => {
        if (nextBtn) nextBtn.style.display = 'flex';
        const next = this.getNextLesson();
        if (next && nextBtn) {
          nextBtn.onclick = () => {
            window.location.href = `/lesson.html?id=${next.id}&slug=${this.course?.slug || ''}`;
          };
        }
      },
    });
  },

  getNextLesson() {
    const idx = this.allLessons.findIndex((l) => l.id === this.lesson.id);
    return idx >= 0 && idx < this.allLessons.length - 1 ? this.allLessons[idx + 1] : null;
  },
};

document.addEventListener('DOMContentLoaded', () => LessonPage.init());
