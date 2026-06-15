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
        this.phone   = '';   // "998901234567"
        this.botUrl  = '';   // "t.me/EduUzBot?start=..."
        this.timer   = null; // Hisoblagich interval
    }

    // ═══════════════════════════════════
    // Tizimga kirish (Telefon + Parol)
    // ═══════════════════════════════════
    async login() {
        const rawVal = document.getElementById('loginPhoneInput').value.replace(/\D/g, '');
        const phone = rawVal.startsWith('998') ? rawVal : '998' + rawVal;
        const password = document.getElementById('loginPasswordInput').value;

        if (rawVal.length < 9) {
            toast.error("Telefon raqamni to'liq kiriting");
            return;
        }
        if (!password) {
            toast.error("Parolingizni kiriting");
            return;
        }

        const btn = document.getElementById('loginBtn');
        btn.disabled = true;
        btn.innerHTML = '⏳ Kirilmoqda...';

        try {
            const res = await API.post('/auth/login/', { phone, password });
            if (res.success) {
                API.setTokens(res.data.access, res.data.refresh);
                localStorage.setItem('user_role', res.data.user.role);
                localStorage.setItem('user_data', JSON.stringify(res.data.user));

                toast.success("Muvaffaqiyatli kirdingiz!");
                setTimeout(() => {
                    this.redirect(res.data.user.role);
                }, 1000);
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error(e.message || "Telefon raqami yoki parol noto'g'ri.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = '🔑 Kirish';
        }
    }

    // ═══════════════════════════════════
    // QADAM 1: Telefon yuborish
    // ═══════════════════════════════════
    async sendOTP() {
        const phone = this.getRawPhone();

        // Validatsiya: kamida 9 ta raqam
        if (phone.replace(/^998/, '').length < 9) {
            toast.error("Telefon raqamni to'liq kiriting");
            return;
        }

        const btn = document.getElementById('sendOtpBtn');
        btn.disabled  = true;
        btn.innerHTML = '⏳ Yuborilmoqda...';

        try {
            const res = await API.post('/auth/send-otp/', { phone });

            if (res.success) {
                this.phone  = res.data.phone;
                this.botUrl = res.data.bot_url;
                this.goToStep(2);
                this.startTimer(300); // 5 daqiqa
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error(e.message || "Xatolik yuz berdi. Qayta urinib ko'ring.");
        } finally {
            btn.disabled  = false;
            btn.innerHTML = '📲 Telegram orqali kod olish';
        }
    }

    // ═══════════════════════════════════
    // QADAM 2: Botni ochish
    // ═══════════════════════════════════
    openBot() {
        // Botni yangi tabda ochish
        window.open(this.botUrl, '_blank');

        // 3 soniyadan keyin "Kodni oldim" tugmasi paydo bo'ladi
        setTimeout(() => {
            const btn = document.getElementById('gotCodeBtn');
            if (btn) btn.style.display = 'block';
        }, 3000);
    }

    // ═══════════════════════════════════
    // QADAM 2: Qayta yuborish
    // ═══════════════════════════════════
    async resendOTP() {
        try {
            const res = await API.post('/auth/resend-otp/', {
                phone: this.phone
            });

            if (res.success) {
                this.botUrl = res.data.bot_url;
                toast.success("Yangi kod yaratildi. Botdan oling.");
                this.startTimer(300); // Hisoblagichni qayta boshlash

                // "Kodni oldim" tugmasini yashirish
                const btn = document.getElementById('gotCodeBtn');
                if (btn) btn.style.display = 'none';
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error(e.message || "Xatolik. Qayta urinib ko'ring.");
        }
    }

    // ═══════════════════════════════════
    // QADAM 3: OTP tekshirish
    // ═══════════════════════════════════
    async verifyOTP() {
        const code = this.getOTPCode();

        if (code.length !== 6) {
            toast.error("6 xonali kodni to'liq kiriting");
            return;
        }

        const btn = document.getElementById('verifyBtn');
        btn.disabled  = true;
        btn.innerHTML = '⏳ Tekshirilmoqda...';

        // Xato xabarini yashirish
        this.hideError();

        try {
            const res = await API.post('/auth/verify-otp/', {
                phone: this.phone,
                code:  code,
            });

            if (res.success) {
                // Tokenlarni saqlash
                API.setTokens(res.data.access, res.data.refresh);
                localStorage.setItem('user_role', res.data.user.role);
                localStorage.setItem('user_data', JSON.stringify(res.data.user));

                toast.success("Muvaffaqiyatli kirdingiz!");

                // Redirect — profil to'liqmi?
                setTimeout(() => {
                    if (res.data.user.is_new || !res.data.user.profile_complete) {
                        this.goToStep(4);
                    } else {
                        this.redirect(res.data.user.role);
                    }
                }, 1000);

            } else {
                // Xato
                this.showError(res.message);
                this.shakeOTP();
                this.clearOTP();
            }
        } catch (e) {
            toast.error(e.message || "Server bilan bog'lanishda xato.");
            this.showError(e.message || "Server bilan bog'lanishda xato.");
            this.shakeOTP();
            this.clearOTP();
        } finally {
            btn.disabled  = false;
            btn.innerHTML = '✅ Tasdiqlash';
        }
    }

    // Complete profile function
    async completeProfile() {
        const firstName = document.getElementById('firstName').value.trim();
        const lastName  = document.getElementById('lastName').value.trim();
        const password  = document.getElementById('newPassword').value;
        const roleCard  = document.querySelector('#step4 .role-card.selected') || document.querySelector('#step4 .role-card.active');
        const role      = roleCard ? roleCard.dataset.role : 'student';
        
        if (!firstName) { 
            toast.error("Ismingizni kiriting"); 
            return; 
        }
        if (!password || password.length < 4) {
            toast.error("Parol kamida 4 xonali bo'lishi shart");
            return;
        }

        let address = '';
        let specialization = '';
        let interests = '';
        let foundSource = '';
        let bankCard = '';

        if (role === 'teacher') {
            address = document.getElementById('addressInput').value.trim();
            specialization = document.getElementById('specializationInput').value.trim();
            interests = document.getElementById('interestsInput').value.trim();
            foundSource = document.getElementById('foundSourceInput').value.trim();
            bankCard = document.getElementById('bankCardInput').value.replace(/\D/g, '');
        }
        
        try {
            const res = await API.post('/auth/register-complete/', {
                first_name: firstName,
                last_name: lastName,
                role,
                password,
                address,
                specialization,
                interests,
                found_source: foundSource,
                bank_card: bankCard
            });
            if (res.success) {
                // Update local storage role
                localStorage.setItem('user_role', role);
                const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
                userData.role = role;
                userData.full_name = firstName + (lastName ? ' ' + lastName : '');
                userData.profile_complete = true;
                localStorage.setItem('user_data', JSON.stringify(userData));
                
                this.redirect(role);
            } else {
                toast.error(res.message);
            }
        } catch (err) {
            toast.error(err.message || "Xatolik yuz berdi");
        }
    }

    // OTP inputlarni sozlash
    setupOTPInputs() {
        const inputs = document.querySelectorAll('.otp-input');

        inputs.forEach((input, i) => {
            // Raqam kiritilganda
            input.addEventListener('input', (e) => {
                // Faqat raqam qabul qilinsin
                e.target.value = e.target.value.replace(/\D/, '');

                if (e.target.value && i < 5) {
                    inputs[i + 1].focus(); // Keyingi inputga o'tish
                }

                // Verify tugmasini faollashtirish
                const code = this.getOTPCode();
                document.getElementById('verifyBtn').disabled =
                    code.length !== 6;

                // 6 ta to'lsa avtomatik tekshirish
                if (code.length === 6) {
                    this.verifyOTP();
                }
            });

            // Backspace bosilganda
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && i > 0) {
                    inputs[i - 1].focus(); // Oldingi inputga qaytish
                }
            });

            // Nusxa qo'yish (paste)
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasted = e.clipboardData
                    .getData('text')
                    .replace(/\D/g, '') // Faqat raqamlar
                    .slice(0, 6);        // Max 6 ta

                if (pasted.length === 6) {
                    inputs.forEach((inp, j) => {
                        inp.value = pasted[j] || '';
                    });
                    this.verifyOTP(); // Avtomatik tekshirish
                }
            });
        });
    }

    // Telefondan toza raqam olish
    getRawPhone() {
        const val = document.getElementById('phoneInput')
            .value.replace(/\D/g, '');
        if (val.startsWith('998')) return val;
        return '998' + val;
    }

    // 6 ta inputdan kodni yig'ish
    getOTPCode() {
        return [...document.querySelectorAll('.otp-input')]
            .map(i => i.value)
            .join('');
    }

    // Inputlarni tozalash
    clearOTP() {
        document.querySelectorAll('.otp-input')
            .forEach(i => i.value = '');
        document.querySelectorAll('.otp-input')[0]?.focus();
        document.getElementById('verifyBtn').disabled = true;
    }

    // Shake animatsiya (noto'g'ri kod)
    shakeOTP() {
        const wrap = document.getElementById('otpWrap');
        if (wrap) {
            wrap.classList.add('shake');
            setTimeout(() => wrap.classList.remove('shake'), 400);
        }
    }

    // Xato xabarini ko'rsatish
    showError(msg) {
        const el = document.getElementById('otpError');
        if (el) {
            el.textContent = msg;
            el.style.display = 'block';
        }
    }

    hideError() {
        const el = document.getElementById('otpError');
        if (el) el.style.display = 'none';
    }

    // Hisoblagich (5 daqiqa = 300 soniya)
    startTimer(seconds) {
        clearInterval(this.timer); // Eski hisoblagichni to'xtatish

        const timerEl  = document.getElementById('timerDisplay');
        const resendBtn = document.getElementById('resendBtn');
        if (resendBtn) resendBtn.disabled = true;

        let t = seconds;

        this.timer = setInterval(() => {
            t--;
            const m = Math.floor(t / 60);
            const s = t % 60;

            if (timerEl) {
                timerEl.textContent =
                    `(${m}:${s.toString().padStart(2, '0')})`;
            }

            if (t <= 0) {
                clearInterval(this.timer);
                if (timerEl)   timerEl.textContent = '';
                if (resendBtn) resendBtn.disabled = false;
            }
        }, 1000);
    }

    // Redirect handler
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

    // Qadam almashtirish
    goToStep(n) {
        document.querySelectorAll('.auth-step').forEach(s => {
            s.style.display = 'none';
        });
        const step = document.getElementById(`step${n}`);
        if (step) step.style.display = 'block';

        // 3-qadamga o'tganda birinchi inputga fokus
        if (n === 3) {
            setTimeout(() => {
                document.querySelector('.otp-input')?.focus();
            }, 100);
        }
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

  // Enter bilan yuborish
  document.getElementById('phoneInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') auth.sendOTP();
  });

  // Login telefon formatlash
  document.getElementById('loginPhoneInput')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,'').slice(0,9);
    const parts = [v.slice(0,2), v.slice(2,5), v.slice(5,7), v.slice(7,9)].filter(Boolean);
    e.target.value = parts.join(' ');
  });

  // Enter bilan Login qilish
  document.getElementById('loginPhoneInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') auth.login();
  });
  document.getElementById('loginPasswordInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') auth.login();
  });

  auth.setupOTPInputs();
});
