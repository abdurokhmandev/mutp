const token = window.location.pathname.split('/invite/')[1]?.replace('/', '');

async function loadInvite() {
  if (!token) {
    document.getElementById('inviteLoading').innerHTML = `
      <p>❌ Havola noto'g'ri (token topilmadi).</p>
      <a href="/courses.html" class="btn-secondary">Kurslarni ko'rish</a>`;
    return;
  }

  try {
    const res = await API.get(`/invite/${token}/`);
    const { course, link_info } = res.data;

    document.getElementById('inviteLoading').style.display = 'none';
    document.getElementById('inviteCard').style.display = 'block';

    // Kurs ma'lumotlari
    document.getElementById('inviteCourseTitle').textContent = course.title;
    document.getElementById('inviteInstructor').textContent = `👨‍🏫 Ustoz: ${course.instructor_name}`;
    document.getElementById('inviteLessonsCount').textContent = `📚 ${course.total_lessons} dars`;
    document.getElementById('inviteLevel').textContent = `📶 ${course.level}`;
    document.getElementById('invitePrice').textContent = course.is_free ? '🆓 Bepul' : `💳 ${course.price.toLocaleString('uz-UZ')} so'm`;

    // Thumbnail
    const thumb = document.getElementById('inviteThumb');
    if (course.thumbnail) {
      thumb.innerHTML = `<img src="${course.thumbnail}" alt="${course.title}">`;
    } else {
      thumb.innerHTML = `<div class="thumb-placeholder">📚</div>`;
    }

    // Limit ko'rsatkichi
    if (course.enrollment_limit) {
      const limitDiv = document.getElementById('inviteLimit');
      limitDiv.style.display = 'block';
      const pct = Math.min((link_info.use_count / course.enrollment_limit) * 100, 100);
      document.getElementById('inviteLimitFill').style.width = `${pct}%`;
      document.getElementById('inviteLimitLabel').textContent =
        `${link_info.use_count} / ${course.enrollment_limit} o'rin band`;
    }

    // Havola yaroqsizmi?
    if (!link_info.is_valid) {
      const err = document.getElementById('inviteError');
      err.style.display = 'block';
      const msgs = {
        expired: 'Bu havolaning muddati o\'tib ketgan.',
        full: `Kursga maksimal o\'quvchilar (${course.enrollment_limit} ta) yozilgan.`,
        inactive: 'Bu havola o\'chirilgan.'
      };
      document.getElementById('inviteErrorTitle').textContent = 'Havola yaroqsiz';
      document.getElementById('inviteErrorMsg').textContent = msgs[link_info.reason] || 'Havola yaroqsiz yoki muddati o\'tgan.';
      
      // Hide actions
      document.getElementById('inviteApprovalForm').style.display = 'none';
      document.getElementById('inviteJoinDirect').style.display = 'none';
      return;
    }

    // Login qilmagan bo'lsa
    if (!Auth.isLoggedIn()) {
      localStorage.setItem('redirect_after_login', window.location.href);
      window.location.href = '/auth.html?redirect=invite';
      return;
    }

    // Allaqachon yozilgan
    if (link_info.already_enrolled) {
      document.getElementById('inviteAlreadyEnrolled').style.display = 'block';
      document.getElementById('goToCourseBtn').href = `/course-detail.html?slug=${course.slug}`;
      return;
    }

    // Tasdiqlash kerak
    if (course.require_approval) {
      document.getElementById('inviteApprovalForm').style.display = 'block';
      document.getElementById('joinBtn').onclick = submitJoinRequest;
    } else {
      document.getElementById('inviteJoinDirect').style.display = 'block';
      document.getElementById('joinDirectBtn').onclick = joinDirect;
    }

  } catch(e) {
    console.error(e);
    document.getElementById('inviteLoading').innerHTML = `
      <p>❌ Havola topilmadi yoki noto'g'ri.</p>
      <a href="/courses.html" class="btn-secondary">Barcha kurslarni ko'rish</a>`;
  }
}

async function submitJoinRequest() {
  const message = document.getElementById('inviteMessage').value;
  const btn = document.getElementById('joinBtn');
  btn.textContent = 'Yuborilmoqda...';
  btn.disabled = true;
  try {
    await API.post(`/invite/${token}/join/`, { message });
    document.getElementById('inviteApprovalForm').style.display = 'none';
    document.getElementById('inviteRequestSent').style.display = 'block';
  } catch (err) {
    btn.textContent = 'So\'rov yuborish →';
    btn.disabled = false;
    window.toast?.show(err.message || 'Xatolik yuz berdi', 'error');
  }
}

async function joinDirect() {
  const btn = document.getElementById('joinDirectBtn');
  btn.textContent = 'Yozilmoqda...';
  btn.disabled = true;
  try {
    const res = await API.post(`/invite/${token}/join/`);
    const data = res.data;
    if (data.status === 'enrolled') {
      window.toast?.show('Muvaffaqiyatli yozildingiz!', 'success');
      setTimeout(() => window.location.href = `/course-detail.html?slug=${data.course_slug}`, 1500);
    }
  } catch (err) {
    btn.textContent = 'Kursga yozilish →';
    btn.disabled = false;
    window.toast?.show(err.message || 'Xatolik yuz berdi', 'error');
  }
}

loadInvite();
