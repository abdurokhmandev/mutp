// auth.js — JWT autentifikatsiya
const Auth = {
  async login(email, password) {
    try {
      const result = await API.post('/auth/login/', { email, password });
      const { user, access, refresh } = result.data;

      API.setTokens(access, refresh);
      localStorage.setItem('user_role', user.role);
      localStorage.setItem('user_data', JSON.stringify(user));

      window.toast.show(result.message || "Muvaffaqiyatli kirdingiz", 'success');
      return user;
    } catch (error) {
      const msg = this._extractError(error);
      window.toast?.show(msg, 'error');
      return null;
    }
  },

  async register(firstName, lastName, email, password, role, extraFields = {}) {
    try {
      const result = await API.post('/auth/register/', {
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        password2: password,
        role,
      });
      const { user, access, refresh } = result.data;

      API.setTokens(access, refresh);
      localStorage.setItem('user_role', user.role);
      localStorage.setItem('user_data', JSON.stringify(user));

      if (role === 'teacher' && Object.keys(extraFields).length > 0) {
        try {
          const profileResult = await API.patch('/auth/profile/', extraFields);
          if (profileResult.data) {
            localStorage.setItem('user_data', JSON.stringify(profileResult.data));
          }
        } catch (patchErr) {
          console.error("O'qituvchi qo'shimcha ma'lumotlarini saqlashda xatolik:", patchErr);
        }
      }

      window.toast.show(result.message || "Muvaffaqiyatli ro'yxatdan o'tdingiz", 'success');
      return user;
    } catch (error) {
      const msg = this._extractError(error);
      window.toast?.show(msg, 'error');
      return null;
    }
  },

  async logout() {
    const refresh = API.getRefreshToken();
    if (refresh) {
      try {
        await API.post('/auth/logout/', { refresh });
      } catch {
        // Token allaqachon yaroqsiz bo'lishi mumkin
      }
    }

    API.clearTokens();
    window.toast.show('Tizimdan chiqdingiz', 'info');
    window.location.href = '/';
  },

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

  _extractError(error) {
    if (error.errors && typeof error.errors === 'object') {
      const messages = Object.entries(error.errors).flatMap(([field, msgs]) => {
        const list = Array.isArray(msgs) ? msgs : [msgs];
        return list.map((m) => (field !== 'non_field_errors' ? `${field}: ${m}` : m));
      });
      if (messages.length) return messages[0];
    }
    return error.message || "Xatolik yuz berdi. Qaytadan urinib ko'ring.";
  },
};

window.Auth = Auth;
