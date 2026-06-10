// auth.js
const Auth = {
  login(email, password) {
    // Simulate login without validation

    // Simulate login
    localStorage.setItem('auth_token', 'dummy_token');
    localStorage.setItem('user_role', 'student');
    window.toast.show('Muvaffaqiyatli kirdingiz', 'success');
    return true;
  },

  register(name, email, password, role) {
    // Simulate register without validation

    // Simulate register
    localStorage.setItem('auth_token', 'dummy_token');
    localStorage.setItem('user_role', role);
    window.toast.show('Muvaffaqiyatli ro\'yxatdan o\'tdingiz', 'success');
    return true;
  },

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    window.toast.show('Tizimdan chiqdingiz', 'info');
    window.location.href = 'index.html';
  },

  isLoggedIn() {
    return !!localStorage.getItem('auth_token');
  },
  
  getRole() {
    return localStorage.getItem('user_role');
  }
};

window.Auth = Auth;
