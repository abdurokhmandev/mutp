// onboarding.js — Profilni to'ldirish boshqaruvi

const user = JSON.parse(localStorage.getItem('user_data') || '{}');
const isTeacher = user.role === 'teacher';

// Toast helper wrapper
const toast = {
  error: (msg) => window.toast ? window.toast.show(msg, 'error') : alert(msg),
  success: (msg) => window.toast ? window.toast.show(msg, 'success') : alert(msg)
};

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
  const progressWrap = document.getElementById('progressWrap');
  if (isTeacher) {
    if (progressWrap) progressWrap.style.display = 'flex';
    updateStepIndicator(1);
  }

  // Pre-fill user data if available
  if (user.first_name) document.getElementById('firstName').value = user.first_name;
  if (user.last_name) document.getElementById('lastName').value = user.last_name;
  if (user.email && !user.email.endsWith('@mutp.local')) {
    document.getElementById('emailField').value = user.email;
  }
  updateAvatarInitials();

  // Avatar file input listener
  const fileInput = document.getElementById('avatarFile');
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          const img = document.getElementById('avatarImg');
          const initials = document.getElementById('avatarInitials');
          if (img && initials) {
            img.src = evt.target.result;
            img.style.display = 'block';
            initials.style.display = 'none';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Bio char count
  const bio = document.getElementById('bio');
  if (bio) {
    bio.addEventListener('input', function() {
      const countEl = document.getElementById('bioCount');
      if (countEl) countEl.textContent = this.value.length;
    });
  }

  // Experience year buttons
  document.querySelectorAll('.exp-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.exp-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      const customInput = document.getElementById('experienceYears');
      const val = this.dataset.val;

      if (val === 'custom') {
        if (customInput) {
          customInput.style.display = 'block';
          customInput.value = '';
          customInput.focus();
        }
      } else {
        if (customInput) {
          customInput.style.display = 'none';
          customInput.value = val;
        }
      }
    });
  });

  // Card type selector
  document.querySelectorAll('.card-type-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.card-type-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });
});

// Update initials in avatar preview circle
function updateAvatarInitials() {
  const first = document.getElementById('firstName').value.trim();
  const last = document.getElementById('lastName').value.trim();
  const initials = document.getElementById('avatarInitials');
  
  if (initials) {
    if (first || last) {
      initials.textContent = ((first[0] || '') + (last[0] || '')).toUpperCase();
    } else {
      initials.textContent = '?';
    }
  }
}

// Bind live changes for initials
document.getElementById('firstName')?.addEventListener('input', updateAvatarInitials);
document.getElementById('lastName')?.addEventListener('input', updateAvatarInitials);

function toggleCustomSpecialization(select) {
  const customInput = document.getElementById('specializationCustom');
  if (customInput) {
    if (select.value === 'Boshqa') {
      customInput.style.display = 'block';
      customInput.focus();
    } else {
      customInput.style.display = 'none';
    }
  }
}

function updateStepIndicator(step) {
  const fill = document.getElementById('progressFill');
  if (fill) {
    const percent = step === 1 ? '33.33%' : step === 2 ? '66.66%' : '100%';
    fill.style.width = percent;
  }
}

// Validation function
function validateStep(step) {
  if (step === 1) {
    const first = document.getElementById('firstName').value.trim();
    const last = document.getElementById('lastName').value.trim();
    if (!first || !last) {
      toast.error('Ism va familiyani kiritish majburiy!');
      return false;
    }
    return true;
  }
  
  if (step === 2) {
    const specSelect = document.getElementById('specialization');
    let spec = specSelect.value;
    if (spec === 'Boshqa') {
      spec = document.getElementById('specializationCustom').value.trim();
    }
    if (!spec) {
      toast.error('Mutaxassisligingizni kiriting!');
      return false;
    }

    const expVal = document.getElementById('experienceYears').value;
    if (!expVal) {
      toast.error('Tajribangizni tanlang yoki kiriting!');
      return false;
    }

    const bio = document.getElementById('bio').value.trim();
    if (!bio) {
      toast.error('O\'zingiz haqingizda Bio kiriting!');
      return false;
    }
    return true;
  }

  return true;
}

// Navigate to step
function goToStep(step) {
  // If moving forward, validate current step
  const currentActiveStep = parseInt(document.querySelector('.onboard-step[style*="display: block"]').id.replace('onboard-', ''));
  if (step > currentActiveStep && !validateStep(currentActiveStep)) {
    return;
  }

  // Student bypasses Step 2 and Step 3
  if (!isTeacher && step > 1) {
    saveAndFinish();
    return;
  }

  document.querySelectorAll('.onboard-step').forEach(s => s.style.display = 'none');
  const targetStep = document.getElementById(`onboard-${step}`);
  if (targetStep) targetStep.style.display = 'block';

  updateStepIndicator(step);
}

// Card input formatters
function formatCardNumber(input) {
  let val = input.value.replace(/\D/g, '').slice(0, 16);
  input.value = val.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(input) {
  let val = input.value.replace(/\D/g, '').slice(0, 4);
  if (val.length >= 2) {
    val = val.slice(0, 2) + '/' + val.slice(2);
  }
  input.value = val;
}

// Save profile details to API
async function saveAndFinish() {
  if (isTeacher && !validateStep(3)) return;

  const btn = document.querySelector('#onboard-3 .btn-hero') || document.querySelector('#onboard-1 .btn-hero');
  const originalText = btn ? btn.textContent : '';
  if (btn) {
    btn.textContent = 'Saqlanmoqda...';
    btn.disabled = true;
  }

  const formData = new FormData();
  formData.append('first_name', document.getElementById('firstName').value.trim());
  formData.append('last_name', document.getElementById('lastName').value.trim());
  formData.append('profile_complete', 'true');

  const email = document.getElementById('emailField').value.trim();
  if (email) {
    formData.append('email', email);
  }

  const avatar = document.getElementById('avatarFile').files[0];
  if (avatar) {
    formData.append('avatar', avatar);
  }

  if (isTeacher) {
    const specSelect = document.getElementById('specialization');
    let specialization = specSelect.value;
    if (specialization === 'Boshqa') {
      specialization = document.getElementById('specializationCustom').value.trim();
    }
    formData.append('specialization', specialization);

    const expYears = document.getElementById('experienceYears').value;
    formData.append('experience_years', expYears);

    const workplace = document.getElementById('workplace').value.trim();
    if (workplace) {
      formData.append('workplace', workplace);
    }

    const bio = document.getElementById('bio').value.trim();
    formData.append('bio', bio);

    const cardNum = document.getElementById('cardNumber').value.replace(/\s/g, '');
    if (cardNum) {
      formData.append('bank_card', cardNum);
    }
  }

  try {
    const result = await API.patch('/auth/profile/', formData);
    if (result.success) {
      toast.success('Profil muvaffaqiyatli saqlandi! 🎉');
      
      // Update local storage user profile
      const updatedUser = result.data;
      localStorage.setItem('user_data', JSON.stringify(updatedUser));
      localStorage.setItem('user_role', updatedUser.role);

      setTimeout(() => {
        window.location.href = isTeacher ? 'dashboard-teacher.html' : 'dashboard-student.html';
      }, 1000);
    } else {
      toast.error(result.message || 'Xatolik yuz berdi');
      if (btn) {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }
  } catch (err) {
    toast.error('Profilni saqlashda xato yuz berdi');
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }
}

function skipOnboarding() {
  window.location.href = isTeacher ? 'dashboard-teacher.html' : 'dashboard-student.html';
}
