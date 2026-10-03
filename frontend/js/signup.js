// New-user sign-up: one question per screen, picked by ?q= (SIGNUP_QUESTIONS in
// options.js, in the order of ONBOARDING in shared.js). Email, password, name and
// company are asked here; location and office reuse the intake pages, which come
// back here for the company question. The password step creates the account, so
// every later answer is saved to the profile as it's given.
(function () {
  const key = new URLSearchParams(window.location.search).get('q') || 'email';
  const question = SIGNUP_QUESTIONS[key];
  const index = ONBOARDING.findIndex(function (step) { return step.key === key; });
  if (!question || index === -1) {
    window.location.replace(ONBOARDING[0].page);
    return;
  }

  // Every question after the first belongs to a sign-up that's under way.
  if (index > 0 && !inOnboarding()) {
    window.location.replace(ONBOARDING[0].page);
    return;
  }

  // Once the account exists its email and password can't be changed from here.
  if (index <= 1 && inOnboarding() && readStep('user')) {
    window.location.replace(nextPage('password'));
    return;
  }

  // Opening the first question starts a fresh sign-up.
  if (index === 0 && !inOnboarding()) {
    clearSession();
    saveStep('onboarding', true);
  }

  const saved = requireAnswered(ONBOARDING.slice(0, index));
  if (!saved) return;

  const form = document.getElementById('question-form');
  const button = document.getElementById('continue');

  renderStep(key);
  document.getElementById('heading').textContent = question.heading;
  document.getElementById('lead').textContent = question.lead;
  document.getElementById('demo-login').hidden = !(index === 0 && demoLoginActive());
  document.getElementById('sign-in-instead').hidden = index !== 0;
  button.textContent = question.button;
  renderEarlierAnswers();

  if (question.kind === 'choice') {
    setupChoiceQuestion();
  } else {
    setupTextQuestion();
  }

  // Earlier answers, each with a link back to change it. The email can only
  // change until the account is created; after that the page header shows it.
  function renderEarlierAnswers() {
    const earlier = ONBOARDING.slice(0, index).map(function (step) { return step.key; });
    function asked(step) { return earlier.indexOf(step) !== -1; }

    renderSummary('email-text', asked('email') && !saved.user ? saved.email : '');
    renderSummary('name-text', asked('name') ? saved.name : '');
    renderSummary('location-text', asked('location') ? formatLocation(saved.location) : '');
    renderSummary('office-text', asked('office') ? officeLabel(saved.office) : '');

    const group = document.getElementById('summary-group');
    group.hidden = !group.querySelector('.summary:not([hidden])');
  }

  // Save a profile answer (name or company), then go on to the next question.
  // After the last one the sign-up is done and the intake picks up at the
  // category step, with the location and office already chosen.
  function saveAnswer(value) {
    saveStep(key, value);
    const next = nextPage(key);
    submitThenGo(button, async function () {
      await saveProfileDetails({ [key]: value });
      if (!next) saveStep('onboarding', false);
    }, next || 'category.html');
  }

  // TEMPORARY: with the demo sign-in on (DEMO_LOGIN in shared.js) no account is
  // made and any email and password works.
  function createAccount(email, password) {
    if (demoLoginActive()) return Promise.resolve({ email: email });
    return window.appAuth.signUp(email, password);
  }

  async function submitPassword(password) {
    button.disabled = true;
    showSendError(button, '');
    let user;
    try {
      user = await createAccount(saved.email, password);
    } catch (e) {
      button.disabled = false;
      showSendError(button, window.appAuth
        ? authMessage(e, 'We couldn\'t create your account just now. Please try again.')
        : 'Sign-in didn\'t load. Refresh the page and try again.');
      return;
    }
    saveStep('user', user.email);
    window.location.href = nextPage('password');
  }

  function submitText(value) {
    if (key === 'email') {
      saveStep('signup_email', value);
      window.location.href = nextPage('email');
    } else if (key === 'password') {
      submitPassword(value);
    } else {
      saveAnswer(value);
    }
  }

  function setupChoiceQuestion() {
    document.getElementById('choice-question').hidden = false;
    renderRadioCards(document.getElementById('choice-options'), key, question.options);
    setupChoiceForm(form, button, key, saved[key], saveAnswer);
  }

  function setupTextQuestion() {
    const fields = [
      { input: document.getElementById('answer'), error: document.getElementById('answer-error') },
      { input: document.getElementById('confirm'), error: document.getElementById('confirm-error') },
    ];
    const answer = fields[0].input;
    const confirm = fields[1].input;
    const noun = question.label.toLowerCase();

    document.getElementById('text-question').hidden = false;
    document.getElementById('answer-label').textContent = question.label;
    if (question.confirmLabel) {
      document.getElementById('confirm-field').hidden = false;
      document.getElementById('confirm-label').textContent = question.confirmLabel;
    }
    [answer, confirm].forEach(function (input) {
      input.type = question.type;
      input.autocomplete = question.autocomplete;
      if (question.type === 'text') input.setAttribute('autocapitalize', 'words');
      if (question.maxLength) input.maxLength = question.maxLength;
    });

    // Prefill when the user came back to change an answer. Passwords aren't kept.
    if (key !== 'password' && saved[key]) {
      answer.value = saved[key];
      confirm.value = saved[key];
    }
    answer.focus();

    // Passwords are taken as typed; everything else is trimmed.
    function valueOf(input) {
      return question.type === 'password' ? input.value : input.value.trim();
    }

    // The first problem with each field, or '' when it's fine.
    function fieldMessages(value, confirmValue) {
      let message = '';
      if (value === '') {
        message = 'Enter your ' + noun + '.';
      } else if (question.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        message = 'Enter a valid email address.';
      } else if (question.minLength && value.length < question.minLength) {
        message = 'Use at least ' + question.minLength + ' characters.';
      }
      const mismatch = question.confirmLabel && confirmValue !== value
        ? 'The ' + noun + 's don\'t match.'
        : '';
      return [message, mismatch];
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const value = valueOf(answer);
      const messages = fieldMessages(value, valueOf(confirm));
      fields.forEach(function (field, i) { setFieldError(field.input, field.error, messages[i]); });
      const firstBad = messages.findIndex(Boolean);
      if (firstBad !== -1) { fields[firstBad].input.focus(); return; }
      submitText(value);
    });
  }
})();
