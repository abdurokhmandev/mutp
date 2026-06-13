// profile.js
const ProfilePage = {
  async init() {
    if (!App.requireAuth()) return;

    const dash = document.getElementById('dashboardLink');
    if (dash) dash.href = App.dashboardUrl(localStorage.getItem('user_role'));

    try {
      const result = await API.get('/auth/profile/');
      this.render(result.data);
      await this.loadCourses(result.data.role);
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  render(user) {
    localStorage.setItem('user_data', JSON.stringify(user));

    const nameEl = document.querySelector('.profile-name');
    const avatarEl = document.querySelector('.profile-avatar');
    const roleEl = document.querySelector('.role-badge');
    const bioEl = document.querySelector('.bio-text');

    if (nameEl) nameEl.textContent = user.full_name;
    if (avatarEl) {
      if (user.avatar) {
        avatarEl.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
      } else {
        avatarEl.textContent = App.initials(user.full_name);
      }
    }
    if (roleEl) roleEl.textContent = user.role === 'teacher' ? "O'qituvchi" : "O'quvchi";
    if (bioEl) bioEl.textContent = user.bio || "Bio hali kiritilmagan.";

    const emailEl = document.querySelector('[data-profile-email]');
    if (emailEl) emailEl.textContent = user.email;

    document.getElementById('editFirstName').value = user.first_name || '';
    document.getElementById('editLastName').value = user.last_name || '';
    document.getElementById('editPhone').value = user.phone || '';
    document.getElementById('editBio').value = user.bio || '';

    const infoList = document.querySelector('.info-list');
    if (infoList) {
      let html = `
        <div class="info-item"><i class="ti ti-mail"></i> ${user.email}</div>
        <div class="info-item"><i class="ti ti-calendar"></i> MUTP a'zosi</div>
      `;
      if (user.role === 'teacher') {
        html += `
          <div class="info-item"><i class="ti ti-briefcase"></i> Mutaxassislik: ${user.specialization || "Kiritilmagan"}</div>
          <div class="info-item"><i class="ti ti-device-laptop"></i> Tajriba: ${user.experience_years || 0} yil</div>
          <div class="info-item"><i class="ti ti-star"></i> Baho: ${(user.average_rating || 0).toFixed(1)}★</div>
          <div class="info-item"><i class="ti ti-users"></i> Talabalar: ${user.total_students || 0} ta</div>
          <div class="info-item"><i class="ti ti-wallet"></i> Daromad: ${Math.round(user.total_earnings || 0).toLocaleString('uz-UZ')} so'm</div>
        `;
        // Show edit fields
        const tEdit = document.getElementById('teacherEditFields');
        if (tEdit) tEdit.style.display = 'block';
        document.getElementById('editSpecialization').value = user.specialization || '';
        document.getElementById('editExperience').value = user.experience_years || 0;
        document.getElementById('editBankCard').value = user.bank_card || '';
      } else {
        html += `<div class="info-item"><i class="ti ti-books"></i> Kurslar soni: ${user.courses_count || 0} ta</div>`;
      }
      infoList.innerHTML = html;
    }

    const logoutBtn = document.querySelector('[data-logout]');
    if (logoutBtn) logoutBtn.onclick = (e) => { e.preventDefault(); Auth.logout(); };
  },

  async loadCourses(role) {
    const grid = document.querySelector('.p-courses-grid');
    if (!grid) return;

    try {
      let courses = [];
      if (role === 'teacher') {
        const res = await API.get('/courses/teacher/courses/');
        courses = res.data || [];
        grid.innerHTML = courses.map((c) => Courses.renderCourseCard(c)).join('');
      } else {
        const res = await API.get('/courses/student/enrollments/');
        const enrollments = res.data || [];
        grid.innerHTML = enrollments.map((e) => Courses.renderCourseCard(e.course)).join('');
      }
    } catch {
      grid.innerHTML = '<p style="color:var(--muted)">Kurslar topilmadi</p>';
    }
  },

  async saveProfile() {
    try {
      const payload = {
        first_name: document.getElementById('editFirstName').value.trim(),
        last_name: document.getElementById('editLastName').value.trim(),
        phone: document.getElementById('editPhone').value.trim(),
        bio: document.getElementById('editBio').value.trim(),
      };
      
      const role = localStorage.getItem('user_role');
      if (role === 'teacher') {
        payload.specialization = document.getElementById('editSpecialization').value.trim();
        payload.experience_years = parseInt(document.getElementById('editExperience').value) || 0;
        payload.bank_card = document.getElementById('editBankCard').value.trim();
      }

      const res = await API.patch('/auth/profile/', payload);
      this.render(res.data);
      closeModal();
      window.toast?.show('Profil yangilandi', 'success');
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },
};

function openModal() {
  document.getElementById('editModal')?.classList.add('active');
}
function closeModal() {
  document.getElementById('editModal')?.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => ProfilePage.init());
