// Sign in, or create an account, with Firebase Auth (see firebase.js). Then ask
// the backend what it remembers about the user: with a saved location the
// location step is skipped, otherwise the user is asked for it once.
(function () {
  const form = document.getElementById('auth-form');
  const button = document.getElementById('auth-submit');
  const emailInput = document.getElementById('email');
  const confirmEmailInput = document.getElementById('confirm-email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const switchButton = document.getElementById('switch-mode');

  const fields = [
    { input: emailInput, error: document.getElementById('email-error') },
    { input: confirmEmailInput, error: document.getElementById('confirm-email-error') },
    { input: passwordInput, error: document.getElementById('password-error') },
    { input: confirmPasswordInput, error: document.getElementById('confirm-password-error') },
  ];

  const MODES = {
    signIn: {
      title: 'Sign in',
      lead: 'Sign in to find a dental office and get started.',
      submit: 'Sign in',
      switchText: 'New here?',
      switchLabel: 'Create an account',
    },
    signUp: {
      title: 'Create an account',
      lead: 'Create an account to find a dental office and get started.',
      submit: 'Create account',
      switchText: 'Already have an account?',
      switchLabel: 'Sign in',
    },
  };
  let mode = 'signIn';

  document.getElementById('demo-login').hidden = !demoLoginActive();

  if (new URLSearchParams(window.location.search).has('signed-out')) {
    document.getElementById('signed-out').hidden = false;
  }

  // An empty message hides the error.
  function setError(field, message) {
    field.error.textContent = message;
    field.error.hidden = !message;
    field.input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function clearErrors() {
    fields.forEach(function (field) { setError(field, ''); });
    showSendError(button, '');
  }

  function setMode(next) {
    mode = next;
    const text = MODES[mode];
    const signingUp = mode === 'signUp';
    document.getElementById('auth-title').textContent = text.title;
    document.getElementById('auth-lead').textContent = text.lead;
    document.getElementById('switch-text').textContent = text.switchText;
    button.textContent = text.submit;
    switchButton.textContent = text.switchLabel;
    document.getElementById('confirm-email-field').hidden = !signingUp;
    document.getElementById('confirm-password-field').hidden = !signingUp;
    passwordInput.setAttribute('autocomplete', signingUp ? 'new-password' : 'current-password');
    clearErrors();
  }

  switchButton.addEventListener('click', function () {
    setMode(mode === 'signIn' ? 'signUp' : 'signIn');
    emailInput.focus();
  });

  // The first problem with each field, or '' when it's fine. Confirm fields only
  // count when creating an account.
  function fieldMessages(email, password) {
    const signingUp = mode === 'signUp';
    return [
      email === '' ? 'Enter your email.' : '',
      signingUp && confirmEmailInput.value.trim() !== email ? 'The emails don\'t match.' : '',
      password === '' ? 'Enter your password.' : '',
      signingUp && confirmPasswordInput.value !== password ? 'The passwords don\'t match.' : '',
    ];
  }

  // Friendly text for the Firebase errors people actually run into.
  function authMessage(error) {
    switch (error && error.code) {
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'That email and password don\'t match an account.';
      case 'auth/invalid-email':
        return 'Enter a valid email address.';
      case 'auth/email-already-in-use':
        return 'An account with that email already exists. Sign in instead.';
      case 'auth/weak-password':
        return 'Choose a password with at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait a moment, then try again.';
      case 'auth/network-request-failed':
        return 'We couldn\'t reach the sign-in service. Check your connection and try again.';
      default:
        return 'We couldn\'t sign you in just now. Please try again.';
    }
  }

  // Sign in or create the account. TEMPORARY: with the demo sign-in on
  // (DEMO_LOGIN in shared.js) any email and password works and nothing is checked.
  function authenticate(email, password) {
    if (demoLoginActive()) return Promise.resolve({ email: email });
    return mode === 'signUp'
      ? window.appAuth.signUp(email, password)
      : window.appAuth.signIn(email, password);
  }

  // Signed in: remember who, then skip the location step if the backend already
  // has a location. It is still sent as the intake message, which returns the
  // offices to choose from.
  function continueAs(user) {
    clearSession();
    saveStep('user', user.email);
    submitThenGo(button, async function () {
      const profile = await fetchProfile();
      if (!profile.location) return 'location.html';
      const location = profile.location;
      saveStep('location', { state: location.state, zip: location.zip || '' });
      await sendStep('location', { state: location.state, zip: location.zip || null });
    }, 'office.html');
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const messages = fieldMessages(email, password);
    fields.forEach(function (field, i) { setError(field, messages[i]); });
    const firstBad = messages.findIndex(Boolean);
    if (firstBad !== -1) { fields[firstBad].input.focus(); return; }

    button.disabled = true;
    showSendError(button, '');
    let user;
    try {
      user = await authenticate(email, password);
    } catch (e) {
      button.disabled = false;
      showSendError(button, window.appAuth ? authMessage(e) : 'Sign-in didn\'t load. Refresh the page and try again.');
      return;
    }
    continueAs(user);
  });
})();
