// auth.js — JWT OTP autentifikatsiya
const Auth = {
  isLoggedIn() {
    return !!API.getAccessToken();
  },

  getRole() {
    return localStorage.getItem('user_role');
  },

  getUser() {
    const raw = localStorage.getItem('user_data');
    return raw ? JSON.parse(raw) : null;
  },

  async fetchProfile() {
    const result = await API.get('/auth/profile/');
    localStorage.setItem('user_data', JSON.stringify(result.data));
    localStorage.setItem('user_role', result.data.role);
    return result.data;
  },

  async logout() {
    const refresh = API.getRefreshToken();
    if (refresh) {
      try {
        await API.post('/auth/logout/', { refresh });
      } catch {
        // Session might be expired
      }
    }
    API.clearTokens();
    window.toast?.show('Tizimdan chiqdingiz', 'info');
    window.location.href = '/';
  }
};

window.Auth = Auth;

// Toast wrapper
const toast = {
  error: (msg) => window.toast ? window.toast.show(msg, 'error') : alert(msg),
  success: (msg) => window.toast ? window.toast.show(msg, 'success') : alert(msg)
};

let currentPhone = '';
let timerInterval;

// Step changing helper
function showStep(step) {
  document.querySelectorAll('.auth-step').forEach(s => s.style.display = 'none');
  const activeStep = document.getElementById(`step-${step}`);
  if (activeStep) activeStep.style.display = 'block';
}

// Resend timer handler
function startResendTimer() {
  let seconds = 60;
  document.getElementById('resendTimer').style.display = 'inline';
  document.getElementById('resendBtn').style.display = 'none';

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    seconds--;
    const countEl = document.getElementById('timerCount');
    if (countEl) countEl.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(timerInterval);
      document.getElementById('resendTimer').style.display = 'none';
      document.getElementById('resendBtn').style.display = 'inline';
    }
  }, 1000);
}

// Get full 6-digit OTP code from boxes
function getOtpValue() {
  return Array.from(document.querySelectorAll('.otp-box')).map(b => b.value).join('');
}

function checkOtpFilled() {
  const otp = getOtpValue();
  const verifyBtn = document.getElementById('verifyOtpBtn');
  if (verifyBtn) verifyBtn.disabled = otp.length < 6;
}

// Verify OTP logic
async function verifyOtp() {
  const otp = getOtpValue();
  const roleCard = document.querySelector('input[name="role"]:checked');
  const role = roleCard ? roleCard.value : 'student';

  const btn = document.getElementById('verifyOtpBtn');
  if (!btn) return;
  btn.textContent = 'Tekshirilmoqda...';
  btn.disabled = true;

  try {
    const response = await fetch(`${API.baseUrl}/auth/verify-otp/`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phone: currentPhone, otp, role })
    });
    const result = await response.json();

    if (response.ok && result.success) {
      const { access, refresh, user } = result.data;
      API.setTokens(access, refresh);
      localStorage.setItem('user_role', user.role);
      localStorage.setItem('user_data', JSON.stringify(user));

      toast.success('Muvaffaqiyatli kirdingiz! 🎉');

      setTimeout(() => {
        if (result.data.user.is_new || !result.data.user.profile_complete) {
          window.location.href = 'onboarding.html';
        } else {
          window.location.href = user.role === 'teacher'
            ? 'dashboard-teacher.html'
            : 'dashboard-student.html';
        }
      }, 1000);
    } else {
      const errorMsg = result.message || "Tasdiqlash kodi noto'g'ri";
      toast.error(errorMsg);
      document.getElementById('otpError').style.display = 'block';
      document.querySelectorAll('.otp-box').forEach(b => {
        b.value = '';
        b.classList.add('error');
        // Simple shake animation trigger
        b.style.animation = 'shake 0.3s ease';
      });
      document.querySelector('.otp-box[data-index="0"]').focus();
      setTimeout(() => {
        document.querySelectorAll('.otp-box').forEach(b => {
          b.classList.remove('error');
          b.style.animation = '';
        });
      }, 2000);
    }
  } catch (err) {
    toast.error('Server bilan bog\'lanishda xatolik yuz berdi');
  } finally {
    btn.textContent = 'Tasdiqlash ✓';
    btn.disabled = false;
  }
}

// Bind events on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Role selector cards click
  document.querySelectorAll('.role-card').forEach(card => {
    card.addEventListener('click', function() {
      document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      const radio = this.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Step 1 button click
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  if (sendOtpBtn) {
    sendOtpBtn.addEventListener('click', async () => {
      const raw = document.getElementById('phoneInput').value.replace(/\s/g, '').replace(/-/g, '');
      if (raw.length < 9) {
        toast.error('Telefon raqamni to\'liq kiriting');
        return;
      }
      
      const phone = '998' + raw;
      sendOtpBtn.textContent = 'Yuborilmoqda...';
      sendOtpBtn.disabled = true;
      document.getElementById('telegramNotice').style.display = 'none';

      try {
        const response = await fetch(`${API.baseUrl}/auth/send-otp/`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ phone })
        });
        const result = await response.json();

        if (response.ok && result.success) {
          currentPhone = phone;
          showStep('otp');
          document.getElementById('otpPhoneDisplay').textContent = '+' + phone;
          startResendTimer();
          setTimeout(() => {
            const firstBox = document.querySelector('.otp-box[data-index="0"]');
            if (firstBox) firstBox.focus();
          }, 50);
        } else {
          // Check for bot not started specific error details
          if (result.errors && result.errors.error === 'bot_not_started') {
            document.getElementById('telegramNotice').style.display = 'flex';
            const botLink = document.querySelector('.btn-telegram');
            if (botLink && result.errors.bot_url) {
              botLink.href = result.errors.bot_url;
            }
            toast.error('Avval Telegram botni faollashtiring');
          } else {
            toast.error(result.message || 'Xato yuz berdi');
          }
        }
      } catch (err) {
        toast.error('Server bilan bog\'lanishda xato yuz berdi');
      } finally {
        sendOtpBtn.textContent = 'Kod olish →';
        sendOtpBtn.disabled = false;
      }
    });
  }

  // OTP inputs autofocus navigation and pasting
  document.querySelectorAll('.otp-box').forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      // Allow only numbers
      box.value = box.value.replace(/\D/g, '');
      const val = box.value;
      if (val && idx < 5) {
        const nextBox = document.querySelector(`.otp-box[data-index="${idx + 1}"]`);
        if (nextBox) nextBox.focus();
      }
      checkOtpFilled();
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        const prevBox = document.querySelector(`.otp-box[data-index="${idx - 1}"]`);
        if (prevBox) {
          prevBox.focus();
          prevBox.value = '';
        }
      }
    });

    // Paste 6 digits and auto verify
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      pasted.split('').forEach((char, i) => {
        const input = document.querySelector(`.otp-box[data-index="${i}"]`);
        if (input) input.value = char;
      });
      checkOtpFilled();
      if (pasted.length === 6) {
        verifyOtp();
      }
    });
  });

  // Verify button click
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener('click', verifyOtp);
  }

  // Back button click
  const backToPhone = document.getElementById('backToPhone');
  if (backToPhone) {
    backToPhone.addEventListener('click', () => {
      showStep('phone');
    });
  }

  // Resend button click
  const resendBtn = document.getElementById('resendBtn');
  if (resendBtn) {
    resendBtn.addEventListener('click', () => {
      if (sendOtpBtn) sendOtpBtn.click();
    });
  }
});
