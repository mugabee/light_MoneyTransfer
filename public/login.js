const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const btn = document.getElementById('login-btn');

// If a valid session already exists (e.g. bookmarked /login.html while
// still logged in), skip straight to the dashboard.
fetch('/api/auth/me')
  .then((r) => r.json())
  .then((d) => {
    if (d.authenticated) window.location.href = '/dashboard.html';
  })
  .catch(() => {});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Logging in…';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      errorEl.textContent = data.error || 'Login failed';
      errorEl.hidden = false;
      return;
    }

    window.location.href = '/dashboard.html';
  } catch {
    errorEl.textContent = 'Network error — try again';
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log in';
  }
});
