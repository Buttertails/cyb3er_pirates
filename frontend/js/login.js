// Sign in with Firebase Auth (see firebase.js); new users sign up on signup.html.
// Then ask the backend what it remembers about the user: a sign-up that wasn't
// finished picks up at its first unanswered question; a user whose last sign-in
// was more than 90 days ago answers the update-info questions first; otherwise
// the user goes on to choose an office, with their own office preselected.
(function () {
  const form = document.getElementById('auth-form');
  const button = document.getElementById('auth-submit');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  const fields = [
    { input: emailInput, error: document.getElementById('email-error') },
    { input: passwordInput, error: document.getElementById('password-error') },
  ];

  document.getElementById('demo-login').hidden = !demoLoginActive();

  if (new URLSearchParams(window.location.search).has('signed-out')) {
    document.getElementById('signed-out').hidden = false;
  }

  // TEMPORARY: with the demo sign-in on (DEMO_LOGIN in shared.js) any email and
  // password works and nothing is checked.
  function authenticate(email, password) {
    if (demoLoginActive()) return Promise.resolve({ email: email });
    return window.appAuth.signIn(email, password);
  }

  // Signed in: remember who, and what their profile holds. A saved location is
  // still sent as the intake message, which returns the offices to choose from
  // and drops a saved office that's no longer among them. Then pick up the first
  // sign-up question still unanswered (an unfinished sign-up, or an account made
  // before sign-up asked it), or the update questions when the last sign-in was
  // long ago, or go on to choose an office. A long-ago sign-in isn't replaced
  // until the update is finished (finishFlow), so skipping it asks again.
  function continueAs(user) {
    clearSession();
    saveStep('user', user.email);
    submitThenGo(button, async function () {
      const profile = await fetchProfile();
      ['name', 'company', 'office'].forEach(function (key) {
        if (profile[key]) saveStep(key, profile[key]);
      });
      if (profile.location) {
        const location = profile.location;
        saveStep('location', { state: location.state, zip: location.zip || '' });
        await sendStep('location', { state: location.state, zip: location.zip || null });
      }

      const answers = answeredSteps();
      const unanswered = ONBOARDING.find(function (step) { return !answers[step.key]; });
      if (unanswered) {
        await recordSignIn();
        saveStep('onboarding', true);
        return unanswered.page;
      }
      if (signInIsStale(profile.last_sign_in_at)) {
        saveStep('previous_sign_in', profile.last_sign_in_at);
        return startUpdate('stale', 'office.html');
      }
      await recordSignIn();
    }, 'office.html');
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const messages = [
      email === '' ? 'Enter your email.' : '',
      password === '' ? 'Enter your password.' : '',
    ];
    fields.forEach(function (field, i) { setFieldError(field.input, field.error, messages[i]); });
    const firstBad = messages.findIndex(Boolean);
    if (firstBad !== -1) { fields[firstBad].input.focus(); return; }

    button.disabled = true;
    showSendError(button, '');
    let user;
    try {
      user = await authenticate(email, password);
    } catch (e) {
      button.disabled = false;
      showSendError(button, window.appAuth
        ? authMessage(e, 'We couldn\'t sign you in just now. Please try again.')
        : 'Sign-in didn\'t load. Refresh the page and try again.');
      return;
    }
    continueAs(user);
  });
})();
