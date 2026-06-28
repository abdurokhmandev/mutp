// profile.js
const ProfilePage = {
  async init() {
    if (!App.requireAuth()) return;

    const dash = document.getElementById('dashboardLink');
    if (dash) dash.href = App.dashboardUrl(localStorage.getItem('user_role'));

    const params = new URLSearchParams(location.search);
    const userId = params.get('id');
    const currentUser = App.getUser();
    
    // Check if viewing someone else's profile
    const isOthersProfile = userId && currentUser && (String(userId) !== String(currentUser.id));

    try {
      let result;
      if (isOthersProfile) {
        result = await API.get(`/auth/profile/${userId}/`);
      } else {
        result = await API.get('/auth/profile/');
      }
      this.render(result.data, isOthersProfile);
      await this.loadCourses(result.data.role, isOthersProfile, userId);
    } catch (e) {
      window.toast?.show(e.message, 'error');
    }
  },

  render(user, isOthersProfile = false) {
    if (!isOthersProfile) {
      localStorage.setItem('user_data', JSON.stringify(user));
    }

    const nameEl = document.querySelector('.profile-name');
    const avatarEl = document.querySelector('.profile-avatar');
    const roleEl = document.querySelector('.role-badge');
    const bioEl = document.querySelector('.bio-text');

    if (nameEl) nameEl.textContent = user.full_name;
    if (avatarEl) {
      if (user.avatar) {
        avatarEl.innerHTML = `<img src="${App.getMediaUrl(user.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
      } else {
        avatarEl.textContent = App.initials(user.full_name);
      }
    }
    if (roleEl) roleEl.textContent = user.role === 'teacher' ? "O'qituvchi" : "O'quvchi";
    if (bioEl) bioEl.textContent = user.bio || "Bio hali kiritilmagan.";

    const emailEl = document.querySelector('[data-profile-email]');
    if (emailEl) emailEl.textContent = user.email;

    if (!isOthersProfile) {
      document.getElementById('editFirstName').value = user.first_name || '';
      document.getElementById('editLastName').value = user.last_name || '';
      document.getElementById('editPhone').value = user.phone || '';
      document.getElementById('editBio').value = user.bio || '';
    }

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

    const btnContainer = document.getElementById('profileButtonsContainer');
    if (btnContainer) {
      if (isOthersProfile) {
        btnContainer.innerHTML = `
          <button onclick="openDirectChat(${user.id}, event)" class="btn-primary" style="background:var(--duo-green); border-color:var(--duo-green); color:white; padding:8px 16px; font-size:13px; border-radius:8px; display:flex; align-items:center; gap:4px; cursor:pointer; font-weight:700;">
            💬 Xabar yozish
          </button>
        `;
      } else {
        btnContainer.innerHTML = `
          <button class="btn-secondary" onclick="openModal()"><i class="ti ti-edit"></i> Tahrirlash</button>
          <button class="btn-secondary" data-logout style="margin-left:8px;">Chiqish</button>
        `;
        const logoutBtn = document.querySelector('[data-logout]');
        if (logoutBtn) logoutBtn.onclick = (e) => { e.preventDefault(); Auth.logout(); };
      }
    }
  },

  async loadCourses(role, isOthersProfile = false, userId = null) {
    const grid = document.querySelector('.p-courses-grid');
    if (!grid) return;

    try {
      let courses = [];
      if (role === 'teacher') {
        const url = isOthersProfile ? `/auth/teachers/${userId}/` : '/courses/teacher/courses/';
        const res = await API.get(url);
        courses = isOthersProfile ? (res.data?.courses || []) : (res.data || []);
        grid.innerHTML = courses.map((c) => Courses.renderCourseCard(c)).join('');
      } else {
        if (isOthersProfile) {
          grid.innerHTML = '<p style="color:var(--text-2); font-size:13px; padding:20px;">O\'quvchi kurslari faqat uning o\'ziga ko\'rinadi</p>';
        } else {
          const res = await API.get('/courses/student/enrollments/');
          const enrollments = res.data || [];
          grid.innerHTML = enrollments.map((e) => Courses.renderCourseCard(e.course)).join('');
        }
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

document.addEventListener('DOMContentLoaded', () => ProfilePage.init());
