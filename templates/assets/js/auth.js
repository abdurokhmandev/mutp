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

class OTPAuth {
  constructor() {
    this.phone  = '';
    this.botUrl = '';
    this.timer  = null;
  }

  async sendOTP() {
    const phone = this.getRawPhone();
    if (!this.validatePhone(phone)) {
      toast.error("Telefon raqam noto'g'ri. Misol: 901234567");
      return;
    }
    const btn = document.getElementById('sendOtpBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Yuborilmoqda...';

    try {
      const res = await API.post('/auth/send-otp/', { phone });
      if (res.success) {
        this.phone  = res.data.phone;
        this.botUrl = res.data.bot_url;
        this.goToStep(2);
        this.startTimer(300);
      } else {
        toast.error(res.message || "Xatolik yuz berdi");
      }
    } catch (err) {
      toast.error(err.message || "Serverga ulanib bo'lmadi");
    } finally {
      btn.disabled = false;
      btn.textContent = '📲 Telegram orqali kod olish';
    }
  }

  openBot() {
    window.open(this.botUrl, '_blank');
    setTimeout(() => {
      document.getElementById('gotCodeBtn').style.display = 'inline-flex';
    }, 2000);
  }

  async verifyOTP() {
    const code = this.getOTPCode();
    if (code.length !== 6) {
      toast.error("6 xonali kodni to'liq kiriting");
      return;
    }
    
    const roleCard = document.querySelector('#step4 .role-card.selected');
    const role = roleCard ? roleCard.dataset.role : 'student';

    try {
      const res = await API.post('/auth/verify-otp/', {
        phone: this.phone, code, role
      });
      if (res.success) {
        API.setTokens(res.data.access, res.data.refresh);
        localStorage.setItem('user_role', res.data.user.role);
        localStorage.setItem('user_data', JSON.stringify(res.data.user));

        toast.success("Muvaffaqiyatli kirdingiz! 🎉");

        setTimeout(() => {
          if (res.data.user.is_new || !res.data.user.profile_complete) {
            this.goToStep(4);
          } else {
            this.redirect(res.data.user.role);
          }
        }, 1000);
      } else {
        toast.error(res.message || "Kod noto'g'ri");
        this.shakeInputs();
      }
    } catch (err) {
      toast.error(err.message || "Xatolik yuz berdi");
    }
  }

  async completeProfile() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName  = document.getElementById('lastName').value.trim();
    const roleCard  = document.querySelector('#step4 .role-card.selected');
    const role      = roleCard ? roleCard.dataset.role : 'student';
    
    if (!firstName) { 
      toast.error("Ismingizni kiriting"); 
      return; 
    }
    
    try {
      const res = await API.post('/auth/register-complete/', {
        first_name: firstName, last_name: lastName, role
      });
      if (res.success) {
        // Update local storage role
        localStorage.setItem('user_role', role);
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        userData.role = role;
        userData.full_name = firstName + (lastName ? ' ' + lastName : '');
        localStorage.setItem('user_data', JSON.stringify(userData));
        
        this.redirect(role);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err.message || "Xatolik yuz berdi");
    }
  }

  setupOTPInputs() {
    const inputs = document.querySelectorAll('.otp-input');
    inputs.forEach((input, i) => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '');
        if (input.value && i < 5) inputs[i+1].focus();
        if (this.getOTPCode().length === 6) this.verifyOTP();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && i > 0) {
          inputs[i-1].focus();
          inputs[i-1].value = '';
        }
      });
      input.addEventListener('paste', (e) => {
        const p = e.clipboardData.getData('text').replace(/\D/g,'').slice(0, 6);
        if (p.length === 6) {
          inputs.forEach((inp, j) => inp.value = p[j] || '');
          this.verifyOTP();
        }
        e.preventDefault();
      });
    });
  }

  getOTPCode() {
    return [...document.querySelectorAll('.otp-input')]
      .map(i => i.value).join('');
  }

  getRawPhone() {
    return '998' + document.getElementById('phoneInput').value.replace(/\D/g, '');
  }

  validatePhone(phone) {
    return phone.replace(/^998/, '').length === 9;
  }

  startTimer(sec) {
    clearInterval(this.timer);
    const el = document.getElementById('timerDisplay');
    const resendBtn = document.getElementById('resendBtn');
    resendBtn.disabled = true;
    let t = sec;
    this.timer = setInterval(() => {
      t--;
      const m = Math.floor(t/60);
      const s = t % 60;
      el.textContent = `(${m}:${s.toString().padStart(2,'0')})`;
      if (t <= 0) {
        clearInterval(this.timer);
        resendBtn.disabled = false;
        el.textContent = '';
      }
    }, 1000);
  }

  shakeInputs() {
    const wrap = document.querySelector('.otp-wrap');
    wrap.classList.add('shake');
    setTimeout(() => wrap.classList.remove('shake'), 400);
  }

  redirect(role) {
    const next = localStorage.getItem('redirect_after_login');
    if (next) { 
      localStorage.removeItem('redirect_after_login'); 
      window.location.href = next; 
      return; 
    }
    window.location.href = role === 'teacher'
      ? '/dashboard-teacher.html'
      : '/dashboard-student.html';
  }

  goToStep(n) {
    document.querySelectorAll('.auth-step').forEach(s => s.style.display = 'none');
    document.getElementById(`step${n}`).style.display = 'block';
  }
}

const auth = new OTPAuth();

document.addEventListener('DOMContentLoaded', () => {
  // OTP input telefon formatlash
  document.getElementById('phoneInput')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,'').slice(0,9);
    const parts = [v.slice(0,2), v.slice(2,5), v.slice(5,7), v.slice(7,9)].filter(Boolean);
    e.target.value = parts.join(' ');
  });

  auth.setupOTPInputs();
});
