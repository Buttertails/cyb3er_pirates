// MOCK login: accepts any non-empty username and password.
// Only the username is kept, to show who is signed in. The password is never
// stored or sent. Replace this with real authentication handled by the backend.
(function () {
  const form = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const usernameError = document.getElementById('username-error');
  const passwordError = document.getElementById('password-error');

  // An empty message hides the error.
  function setError(input, errorElement, message) {
    errorElement.textContent = message;
    errorElement.hidden = !message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const usernameMessage = username === '' ? 'Enter your username.' : '';
    const passwordMessage = passwordInput.value === '' ? 'Enter your password.' : '';

    setError(usernameInput, usernameError, usernameMessage);
    setError(passwordInput, passwordError, passwordMessage);
    if (usernameMessage) { usernameInput.focus(); return; }
    if (passwordMessage) { passwordInput.focus(); return; }

    // Signing in starts fresh, so a previous person's answers don't carry over.
    signOut();
    saveStep('user', username);
    window.location.href = 'location.html';
  });
})();
