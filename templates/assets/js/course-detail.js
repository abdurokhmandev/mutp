// course-detail.js — premium va to'liq dinamik kurs tafsilotlari
const CourseDetail = {
  course: null,

  getSlug() {
    const querySlug = new URLSearchParams(window.location.search).get('slug');
    if (querySlug) return querySlug;
    
    // Extract slug from URL path, e.g. /courses/python-kursi/
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const coursesIdx = pathParts.indexOf('courses');
    if (coursesIdx !== -1 && pathParts[coursesIdx + 1]) {
      return pathParts[coursesIdx + 1];
    }
    return null;
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

  updateSaveBtn() {
    const saveBtn = document.getElementById('saveBtn');
    if (!saveBtn) return;

    if (this.course.is_saved) {
      saveBtn.innerHTML = 'Saqlangan ✓ <i class="ti ti-heart-filled"></i>';
      saveBtn.style.background = 'var(--duo-green)';
      saveBtn.style.color = 'white';
      saveBtn.style.borderColor = 'var(--duo-green)';
    } else {
      saveBtn.innerHTML = 'Saqlash <i class="ti ti-heart"></i>';
      saveBtn.style.background = 'transparent';
      saveBtn.style.color = 'var(--ink-2)';
      saveBtn.style.borderColor = 'var(--border)';
    }
  },

  getFirstLesson() {
    for (const mod of this.course.modules || []) {
      if (mod.lessons?.length) return mod.lessons[0];
    }
    return null;
  },

  isYouTubeUrl(url) {
    return url.includes('youtube.com') || url.includes('youtu.be');
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

      // Check if user is the teacher of this course to show teacher workspace banner
      const currentUser = App.getUser();
      const isOwner = currentUser && this.course.instructor && (this.course.instructor.id === currentUser.id);
      if (isOwner) {
        this.initTeacherBanner();
      }

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

      // 1. Clickable Instructor and Real Instructor details
      const instructor = this.course.instructor || {
        id: null,
        full_name: this.course.teacher_name,
        specialization: "O'qituvchi",
        avatar: this.course.teacher_avatar,
        bio: "Ushbu o'qituvchi hali bio qo'shmagan.",
        rating: this.course.average_rating,
        students_count: this.course.student_count,
        courses_count: this.course.lessons_count ? 1 : 0
      };

      const instructorRow = document.querySelector('.instructor-row');
      if (instructorRow) {
        instructorRow.style.cursor = 'pointer';
        instructorRow.style.padding = '8px';
        instructorRow.style.borderRadius = '12px';
        instructorRow.style.transition = 'background 0.2s';
        instructorRow.onmouseover = () => { instructorRow.style.background = 'var(--surface-2)'; };
        instructorRow.onmouseout = () => { instructorRow.style.background = 'transparent'; };
        
        let avatarHtml = instructor.avatar 
          ? `<img src="${instructor.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
          : App.initials(instructor.full_name);
        
        instructorRow.innerHTML = `
          <div class="avatar-md" style="display:flex;align-items:center;justify-content:center;overflow:hidden;">${avatarHtml}</div>
          <div>
            <div style="font-weight:600;">${instructor.full_name}</div>
            <div style="font-size:12px;color:var(--blue-mid)">O'qituvchi</div>
          </div>
        `;
        if (instructor.id) {
          instructorRow.onclick = () => {
            window.location.href = `/profile.html?id=${instructor.id}`;
          };
        }
      }

      const instBox = document.querySelector('.inst-box');
      if (instBox) {
        instBox.style.cursor = 'pointer';
        instBox.style.padding = '20px';
        instBox.style.borderRadius = '16px';
        instBox.style.transition = 'background 0.2s';
        instBox.onmouseover = () => { instBox.style.background = 'var(--surface-2)'; };
        instBox.onmouseout = () => { instBox.style.background = 'transparent'; };
        
        if (instructor.id) {
          instBox.onclick = (e) => {
            if (e.target.closest('button')) return;
            window.location.href = `/profile.html?id=${instructor.id}`;
          };
        }

        let avatarHtml = instructor.avatar 
          ? `<img src="${instructor.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
          : App.initials(instructor.full_name);

        instBox.innerHTML = `
          <div class="inst-avatar" style="font-size:24px;color:white;display:flex;align-items:center;justify-content:center;background:var(--blue-mid);overflow:hidden;">${avatarHtml}</div>
          <div class="inst-info" style="flex:1;">
            <h4 class="name" style="margin:0;font-family:'Plus Jakarta Sans';">${instructor.full_name}</h4>
            <p class="specialization" style="margin:4px 0 8px 0;font-size:13px;color:var(--muted);">${instructor.specialization || "O'qituvchi"}</p>
            <div class="inst-stats" style="display:flex;gap:12px;font-size:12px;color:var(--ink-2);margin-bottom:8px;">
              <div class="rating"><i class="ti ti-star-filled" style="color:var(--amber)"></i> ${instructor.rating?.toFixed(1) || '—'} Reyting</div>
              <div class="students-count"><i class="ti ti-users"></i> ${instructor.students_count?.toLocaleString('uz-UZ') || 0} O'quvchi</div>
              <div class="courses-count"><i class="ti ti-video"></i> ${instructor.courses_count || 0} ta Kurs</div>
            </div>
            <div class="inst-bio" style="font-size:13px;line-height:1.5;color:var(--muted);">${instructor.bio || "Bu o'qituvchi hali bio qo'shmagan."}</div>
            <div class="instructor-actions" style="margin-top:12px; display:flex; gap:8px;">
              <button onclick="window.location.href='/profile.html?id=${instructor.id}'" class="btn-secondary" style="padding:6px 12px; font-size:12px; border-radius:8px; cursor:pointer; width:auto; border:1px solid var(--border);">👤 Profil</button>
              <button onclick="openDirectChat(${instructor.id}, event)" class="btn-primary btn-message" style="padding:6px 12px; font-size:12px; border-radius:8px; cursor:pointer; width:auto; margin:0; background:var(--duo-green); border-color:var(--duo-green); color:white;">💬 Xabar yozish</button>
            </div>
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

      // Nima o'rganasiz block rendering
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

      // 2. Save Button Initialization & Handler
      const saveBtn = document.getElementById('saveBtn');
      if (saveBtn) {
        this.updateSaveBtn();
        saveBtn.onclick = async (e) => {
          e.preventDefault();
          if (!App.isLoggedIn()) {
            window.location.href = '/auth.html';
            return;
          }
          try {
            const res = await API.post(`/courses/${this.course.slug}/save/`);
            this.course.is_saved = res.data.saved;
            this.updateSaveBtn();
            if (res.data.saved) {
              window.toast?.show('Kurs saqlandi', 'success');
            } else {
              window.toast?.show('Kurs saqlanganlardan olib tashlandi', 'info');
            }
          } catch (err) {
            window.toast?.show(err.message, 'error');
          }
        };
      }

      // 3. Preview Video / Thumbnail rendering (Strict Fallback / No Broken Images)
      const preview = document.getElementById('previewVideoContainer');
      if (preview) {
        let previewUrl = this.course.preview_video_url;
        let isFreeLessonPreview = false;
        let fallbackLessonId = null;

        if (!previewUrl) {
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

        let imageUrl = this.course.thumbnail;
        if (!imageUrl && previewUrl && this.isYouTubeUrl(previewUrl)) {
          let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
          let match = previewUrl.match(regExp);
          if (match && match[2].length === 11) {
            imageUrl = `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg`;
          }
        }

        if (imageUrl) {
          preview.innerHTML = `
            <img id="previewThumbImg" src="${imageUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px;position:absolute;top:0;left:0;z-index:1;">
            <div class="play-btn" style="z-index:2;"><i class="ti ti-player-play-filled"></i></div>
            <div id="previewFallback" style="background: linear-gradient(135deg, var(--duo-green-bg), var(--duo-green)); display:none; align-items:center; justify-content:center; height:100%; width:100%; border-radius:12px; position:absolute; top:0; left:0; z-index:1;">
              <span style="font-size:48px;">📚</span>
            </div>
          `;
          const thumbImg = document.getElementById('previewThumbImg');
          const fallbackDiv = document.getElementById('previewFallback');
          if (thumbImg && fallbackDiv) {
            thumbImg.onerror = () => {
              thumbImg.style.display = 'none';
              fallbackDiv.style.display = 'flex';
            };
          }
        } else {
          preview.innerHTML = `
            <div style="background: linear-gradient(135deg, var(--duo-green-bg), var(--duo-green)); display:flex; align-items:center; justify-content:center; height:100%; width:100%; border-radius:12px; position:absolute; top:0; left:0; z-index:1;">
              <span style="font-size:48px;">📚</span>
            </div>
            <div class="play-btn" style="z-index:2;"><i class="ti ti-player-play-filled"></i></div>
          `;
        }

        const firstLesson = this.getFirstLesson();
        preview.onclick = () => {
          if (this.course.is_enrolled && firstLesson) {
            window.location.href = `/lesson.html?id=${firstLesson.id}&slug=${this.course.slug}`;
          } else if (previewUrl) {
            if (isFreeLessonPreview && fallbackLessonId) {
              window.location.href = `/lesson.html?id=${fallbackLessonId}&slug=${this.course.slug}`;
            } else {
              window.open(previewUrl, '_blank');
            }
          } else {
            this.enroll();
          }
        };
      }

      const currentUser = App.getUser();
      const isTeacher = currentUser && currentUser.id === (this.course.instructor?.id || this.course.teacher?.id);
      if (this.course.is_enrolled || isTeacher) {
        this.loadHomeworks();
        this.loadForumDiscussions();
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

  async loadHomeworks() {
    const block = document.getElementById('courseHomeworksBlock');
    const container = document.getElementById('courseHomeworksList');
    if (!block || !container) return;

    try {
      const res = await API.get(`/courses/teacher/courses/${this.course.slug}/homeworks/`);
      const homeworks = res.data || [];
      if (homeworks.length > 0) {
        block.style.display = 'block';
        container.innerHTML = homeworks.map(hw => {
          let statusLabel = 'Kutilmoqda';
          let statusClass = 'pending';
          if (hw.submission_status === 'submitted') {
            statusLabel = 'Topshirilgan';
            statusClass = 'submitted';
          } else if (hw.submission_status === 'reviewed') {
            statusLabel = 'Ko\'rib chiqilgan';
            statusClass = 'reviewed';
          }

          const btnText = hw.submission_status === 'pending' ? 'Bajardim ✓' : 'Topshirilgan';
          const btnDisabled = hw.submission_status !== 'pending' ? 'disabled' : '';

          return `
            <div class="homework-card" style="border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:12px; background:var(--white);">
              <div class="homework-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="homework-card-title" style="font-weight:700; font-size:15px; color:var(--ink);">${hw.title}</span>
                <span class="homework-status ${statusClass}" style="font-size:11px; padding:3px 10px; border-radius:99px; font-weight:600;">${statusLabel}</span>
              </div>
              <p class="homework-card-desc" style="font-size:14px; color:var(--ink-2); line-height:1.5; margin-bottom:12px;">${hw.description.replace(/\n/g, '<br>')}</p>
              
              <!-- Homework resources -->
              ${hw.resources && hw.resources.length > 0 ? `
                <div style="margin-bottom:12px;">
                  <span style="font-size:12px; font-weight:700; display:block; margin-bottom:4px;">Materiallar:</span>
                  <div style="display:flex; flex-direction:column; gap:4px;">
                    ${hw.resources.map(r => {
                      const href = r.resource_type === 'link' ? r.url : r.file;
                      return `<a href="${href}" target="_blank" style="font-size:13px; color:var(--duo-green); text-decoration:none;">${r.resource_type === 'link' ? '🔗' : '📁'} ${r.title}</a>`;
                    }).join('')}
                  </div>
                </div>
              ` : ''}

              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="homework-card-meta" style="font-size:12px; color:var(--muted);">⏰ ${hw.deadline_days ? hw.deadline_days + ' kun' : 'Muddatsiz'} ${hw.after_lesson_title ? '· ' + hw.after_lesson_title + 'dan keyin' : ''}</span>
                <button class="btn-primary mark-done-btn" data-hw-id="${hw.id}" ${btnDisabled} style="padding:6px 16px; font-size:13px; border-radius:8px; width:auto; margin:0;">${btnText}</button>
              </div>
            </div>
          `;
        }).join('');

        // Bind mark as done
        container.querySelectorAll('.mark-done-btn').forEach(btn => {
          btn.onclick = async () => {
            const hwId = btn.dataset.hwId;
            try {
              await API.post(`/courses/homeworks/${hwId}/submit/`);
              window.toast?.show("Vazifa muvaffaqiyatli topshirildi!", 'success');
              this.loadHomeworks();
            } catch (err) {
              window.toast?.show(err.message, 'error');
            }
          };
        });

      } else {
        block.style.display = 'none';
      }
    } catch (err) {
      block.style.display = 'none';
    }
  },

  async initTeacherBanner() {
    const banner = document.getElementById('teacherCourseBanner');
    const inviteContainer = document.getElementById('bannerInviteContainer');
    const btnEdit = document.getElementById('btnEditCourseBanner');
    const btnAnalytics = document.getElementById('btnAnalyticsCourseBanner');

    if (!banner) return;
    banner.style.display = 'block';

    if (btnEdit) btnEdit.href = `/create-course.html?slug=${this.course.slug}`;
    if (btnAnalytics) btnAnalytics.href = `/dashboard-teacher.html`;

    if (inviteContainer) {
      inviteContainer.innerHTML = '⏳ Havola yuklanmoqda...';
      try {
        const res = await API.get(`/courses/teacher/courses/${this.course.slug}/invite/`);
        if (res.success && res.data) {
          const data = res.data;
          if (data.is_private) {
            inviteContainer.innerHTML = `
              <span>🔒 Private kurs — Taklif havolasi:</span>
              <strong style="color:#111827; font-family:monospace; background:white; padding:2px 6px; border-radius:4px; border:1px solid #D1D5DB;">${data.invite_url}</strong>
              <button id="btnCopyBannerInvite" class="btn-xs" style="padding:4px 8px; font-size:11px; cursor:pointer; background:#16A34A; color:white; border:none; border-radius:4px;">📋 Nusxa olish</button>
            `;
            const btnCopy = document.getElementById('btnCopyBannerInvite');
            if (btnCopy) {
              btnCopy.onclick = async () => {
                try {
                  await navigator.clipboard.writeText(data.invite_url);
                  const original = btnCopy.textContent;
                  btnCopy.textContent = '✅ Nusxalandi!';
                  btnCopy.style.background = '#15803d';
                  setTimeout(() => {
                    btnCopy.textContent = original;
                    btnCopy.style.background = '#16A34A';
                  }, 2000);
                } catch {
                  const input = document.createElement('input');
                  input.value = data.invite_url;
                  document.body.appendChild(input);
                  input.select();
                  document.execCommand('copy');
                  document.body.removeChild(input);
                  window.toast?.show('Havola nusxalandi!', 'success');
                }
              };
            }
          } else {
            inviteContainer.innerHTML = `
              <span>🌐 Public kurs — Kurs havolasi:</span>
              <strong style="color:#111827; font-family:monospace; background:white; padding:2px 6px; border-radius:4px; border:1px solid #D1D5DB;">${data.course_url}</strong>
              <button id="btnCopyBannerInvite" class="btn-xs" style="padding:4px 8px; font-size:11px; cursor:pointer; background:#16A34A; color:white; border:none; border-radius:4px;">📋 Nusxa olish</button>
            `;
            const btnCopy = document.getElementById('btnCopyBannerInvite');
            if (btnCopy) {
              btnCopy.onclick = async () => {
                try {
                  await navigator.clipboard.writeText(data.course_url);
                  const original = btnCopy.textContent;
                  btnCopy.textContent = '✅ Nusxalandi!';
                  btnCopy.style.background = '#15803d';
                  setTimeout(() => {
                    btnCopy.textContent = original;
                    btnCopy.style.background = '#16A34A';
                  }, 2000);
                } catch {
                  const input = document.createElement('input');
                  input.value = data.course_url;
                  document.body.appendChild(input);
                  input.select();
                  document.execCommand('copy');
                  document.body.removeChild(input);
                  window.toast?.show('Havola nusxalandi!', 'success');
                }
              };
            }
          }
        } else {
          inviteContainer.innerHTML = '<span style="color:#DC2626;">Havolani yuklab bo\'lmadi</span>';
        }
      } catch (err) {
        inviteContainer.innerHTML = '<span style="color:#DC2626;">Xatolik yuz berdi</span>';
      }
    }
  },

  showForumForm() {
    document.getElementById('newForumForm').style.display = 'block';
  },

  hideForumForm() {
    document.getElementById('newForumForm').style.display = 'none';
  },

  async submitForumTopic() {
    const title = document.getElementById('fTitle').value.trim();
    const text = document.getElementById('fText').value.trim();
    if (!title || !text) {
      window.toast?.show("Sarlavha va matnni kiriting", 'error');
      return;
    }

    try {
      await API.post(`/courses/${this.course.slug}/discussions/`, { title, text });
      document.getElementById('fTitle').value = '';
      document.getElementById('fText').value = '';
      this.hideForumForm();
      window.toast?.show("Mavzu ochildi", 'success');
      await this.loadForumDiscussions();
    } catch (e) {
      window.toast?.show(e.message || 'Xatolik', 'error');
    }
  },

  async loadForumDiscussions() {
    const block = document.getElementById('courseForumBlock');
    const container = document.getElementById('courseDiscussionsList');
    if (!block || !container) return;

    block.style.display = 'block';

    try {
      const res = await API.get(`/courses/${this.course.slug}/discussions/`);
      const discussions = res.data || [];
      if (discussions.length === 0) {
        container.innerHTML = '<div class="empty-state">💬 Hali muhokama mavzulari yo\'q. Yangi mavzu ochib forum boshlang!</div>';
        return;
      }

      const currentUser = App.getUser();

      container.innerHTML = discussions.map(d => {
        const isOwner = d.author === currentUser?.id;
        const isCourseTeacher = currentUser && currentUser.id === (this.course.instructor?.id || this.course.teacher?.id);
        const replies = d.replies || [];

        let reactionsHtml = '';
        const emojis = ['👍', '❤️', '😂'];
        emojis.forEach(emoji => {
          const reactors = d.reactions[emoji] || [];
          const hasReacted = reactors.some(r => r.user_id === currentUser?.id);
          reactionsHtml += `
            <button onclick="CourseDetail.toggleForumReact(${d.id}, '${emoji}', 'discussion')" style="padding:4px 8px; border-radius:6px; border:1px solid ${hasReacted ? 'var(--purple)' : 'var(--border)'}; background:${hasReacted ? 'var(--purple-light)' : 'white'}; cursor:pointer; font-size:12px; margin-right:6px;">
              ${emoji} ${reactors.length || ''}
            </button>`;
        });

        const repliesListHtml = replies.map(r => {
          const isReplyAccepted = r.is_accepted;
          let replyReacts = '';
          emojis.forEach(emoji => {
            const reactors = (r.reactions || {})[emoji] || [];
            const hasReacted = reactors.some(reactor => reactor.user_id === currentUser?.id);
            replyReacts += `
              <button onclick="CourseDetail.toggleForumReact(${r.id}, '${emoji}', 'reply')" style="padding:2px 6px; border-radius:6px; border:1px solid ${hasReacted ? 'var(--purple)' : 'var(--border)'}; background:${hasReacted ? 'var(--purple-light)' : 'white'}; cursor:pointer; font-size:11px; margin-right:4px;">
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
                  ${isCourseTeacher ? `
                    <button onclick="CourseDetail.toggleForumAcceptReply(${r.id})" style="border:none; background:transparent; color:${isReplyAccepted ? 'var(--green)' : 'var(--text-3)'}; font-size:11px; cursor:pointer; font-weight:700;">
                      ${isReplyAccepted ? '✅ To\'g\'ri javob' : '✔️ To\'g\'ri javob deb belgilash'}
                    </button>` : (isReplyAccepted ? '<span style="color:var(--green); font-size:11px; font-weight:700;">✅ To\'g\'ri javob</span>' : '')}
                </div>
              </div>
            </div>`;
        }).join('');

        return `
          <div class="forum-item" style="background:white; border:2px solid ${d.is_pinned ? 'var(--purple)' : 'var(--border)'}; border-radius:16px; padding:16px; position:relative; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
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
                ${isCourseTeacher ? `
                  <button onclick="CourseDetail.toggleForumPin(${d.id})" class="btn-xs" style="background:transparent; border:none; color:var(--purple); cursor:pointer; font-size:12px;"><i class="ti ti-pin"></i> Pin</button>` : ''}
                ${(isCourseTeacher || isOwner) ? `
                  <button onclick="CourseDetail.toggleForumResolve(${d.id})" class="btn-xs" style="background:transparent; border:none; color:var(--green); cursor:pointer; font-size:12px;"><i class="ti ti-check"></i> ${d.is_resolved ? 'Hal bo\'ldi' : 'Hal qilish'}</button>` : ''}
              </div>
            </div>

            <!-- Content -->
            <div style="margin-top:12px;">
              <h4 style="font-size:14px; font-weight:700; color:var(--text);">${d.title || ''}</h4>
               <div style="font-size:13px; color:var(--text-2); margin-top:4px;">${App.markdown(d.text)}</div>
            </div>

            <div style="margin-top:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <div>${reactionsHtml}</div>
              <span style="font-size:12px; color:var(--text-3); font-weight:600;">💬 ${replies.length} ta javob ${d.is_resolved ? '• ✅ Hal bo\'ldi' : ''}</span>
            </div>

            <!-- Replies Box -->
            <div style="margin-top:16px; background:#f9fafb; border-radius:12px; padding:12px;">
              <div id="forum-replies-list-${d.id}">${repliesListHtml}</div>
              
              <!-- Reply input -->
              <div style="margin-top:10px; display:flex; gap:8px;">
                <input id="forum-reply-input-${d.id}" type="text" placeholder="Javob yozish..." style="flex:1; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:12px; outline:none; background:white;">
                <button onclick="CourseDetail.submitForumReply(${d.id})" style="padding:6px 12px; border-radius:8px; background:var(--purple); color:white; border:none; font-size:12px; font-weight:600; cursor:pointer;">Yuborish</button>
              </div>
            </div>
          </div>`;
      }).join('');

    } catch (e) {
      container.innerHTML = `<div class="empty-state">Yuklashda xato: ${e.message}</div>`;
    }
  },

  async submitForumReply(discId) {
    const input = document.getElementById(`forum-reply-input-${discId}`);
    const text = input.value.trim();
    if (!text) return;

    try {
      await API.post(`/courses/discussions/${discId}/replies/`, { text });
      input.value = '';
      window.toast?.show("Javob qo'shildi", 'success');
      await this.loadForumDiscussions();
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  async toggleForumReact(id, emoji, targetType) {
    try {
      await API.post(`/courses/discussions/${id}/react/`, { emoji, target_type: targetType });
      await this.loadForumDiscussions();
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  async toggleForumPin(discId) {
    try {
      await API.post(`/courses/discussions/${discId}/pin/`);
      await this.loadForumDiscussions();
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  async toggleForumResolve(discId) {
    try {
      await API.post(`/courses/discussions/${discId}/resolve/`);
      await this.loadForumDiscussions();
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  async toggleForumAcceptReply(replyId) {
    try {
      await API.post(`/courses/discussions/replies/${replyId}/accept/`);
      await this.loadForumDiscussions();
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },
};

async function openDirectChat(userId, event) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        localStorage.setItem('redirect_after_login', window.location.href);
        window.location.href = '/auth.html?next=chat';
        return;
    }

    const btn = event.currentTarget;
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳...';

    try {
        const res = await API.post(`/chat/direct/${userId}/`, {});
        if (res.success && res.data?.channel_id) {
            window.location.href = `/chat.html?channel=${res.data.channel_id}`;
        } else {
            window.toast?.show(res.message || 'Xatolik yuz berdi', 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    } catch (e) {
        window.toast?.show('Server bilan bog\'lanishda xato', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
window.openDirectChat = openDirectChat;

window.CourseDetail = CourseDetail;
