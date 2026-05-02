function showToast(msg, type = 'default') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

function updateThemeIcons() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const sun = document.getElementById('icon-sun');
  const moon = document.getElementById('icon-moon');
  if (sun) sun.classList.toggle('hidden', dark);
  if (moon) moon.classList.toggle('hidden', !dark);
}
updateThemeIcons();

const toggleBtn = document.getElementById('theme-toggle');
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcons();
  });
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) window.location.href = '/dashboard';
  } catch (err) { }
}
checkAuth();

const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('login-email').value,
          password: document.getElementById('login-password').value,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Login failed';
        if (errEl) errEl.textContent = msg;
        showToast(msg, 'error');
        return;
      }
      showToast('Login successful!', 'success');
      window.location.href = '/dashboard';
    } catch (err) {
      console.error(err);
      const msg = 'Network error. Please try again.';
      if (errEl) errEl.textContent = msg;
      showToast(msg, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });
}

const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('register-btn');
    const errEl = document.getElementById('register-error');
    if (errEl) errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Creating account…';
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('reg-name').value,
          email: document.getElementById('reg-email').value,
          password: document.getElementById('reg-password').value,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Registration failed';
        if (errEl) errEl.textContent = msg;
        showToast(msg, 'error');
        return;
      }
      showToast('Account created!', 'success');
      window.location.href = '/dashboard';
    } catch (err) {
      console.error(err);
      const msg = 'Network error. Please try again.';
      if (errEl) errEl.textContent = msg;
      showToast(msg, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create account';
    }
  });
}
