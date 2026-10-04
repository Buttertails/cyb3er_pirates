// Helpers shared by the step pages. Loaded after options.js.

// The steps in order, and the page that collects each one.
const FLOW = [
  { key: 'user', page: 'index.html' },
  { key: 'location', page: 'location.html' },
  { key: 'office', page: 'office.html' },
  { key: 'category', page: 'category.html' },
  { key: 'procedure', page: 'procedure.html' },
  { key: 'timing', page: 'timing.html' },
];

// The questions a new user answers once, in order. signup.html asks the typed
// and company questions; location and office reuse the intake pages, which
// follow this list instead of FLOW while inOnboarding() is true. Finishing it
// carries on into the intake at the category step.
const ONBOARDING = [
  { key: 'email', page: 'signup.html?q=email' },
  { key: 'password', page: 'signup.html?q=password' },
  { key: 'name', page: 'signup.html?q=name' },
  { key: 'location', page: 'location.html' },
  { key: 'office', page: 'office.html' },
  { key: 'company', page: 'signup.html?q=company' },
];

// The update-info questions, asked when the user's last sign-in was more than
// STALE_SIGN_IN_DAYS ago, or whenever they pick "Update info" in the header.
// Location and office reuse the intake pages and are only asked when the user
// says they've moved (see updateSteps). Finishing returns to where it started.
const UPDATE = [
  { key: 'procedures', page: 'procedures.html' },
  { key: 'location-check', page: 'location-check.html' },
  { key: 'location', page: 'location.html' },
  { key: 'office', page: 'office.html' },
];

const STALE_SIGN_IN_DAYS = 90;

// Set to true only for a local UI demo that should bypass Firebase Auth.
const DEMO_LOGIN = false;

function demoLoginActive() {
  const host = window.location.hostname;
  return DEMO_LOGIN &&
    (window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1');
}

// Read a saved step. Returns null if nothing is saved or storage is unavailable.
function readStep(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key));
  } catch (e) {
    return null;
  }
}

function saveStep(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* ignore: the next page sends the user back if nothing was saved */ }
}

// Forget the answers and the conversation, but stay signed in.
function clearAnswers() {
  const user = readStep('user');
  try {
    sessionStorage.clear();
  } catch (e) { /* ignore */ }
  if (user) saveStep('user', user);
}

// Forget everything this tab saved, including who is signed in. Firebase's own
// sign-in is untouched; signOut() ends that too.
function clearSession() {
  try {
    sessionStorage.clear();
  } catch (e) { /* ignore */ }
}

// Sign out of Firebase and forget everything this tab saved.
async function signOut() {
  try {
    if (window.appAuth) await window.appAuth.signOut();
  } catch (e) { /* still forget everything locally */ }
  clearSession();
}

// True while a new user is answering the ONBOARDING questions.
function inOnboarding() {
  return readStep('onboarding') === true;
}

// True while the user is answering the UPDATE questions.
function inUpdate() {
  return readStep('updating') === true;
}

// The UPDATE steps that apply: location and office only once the user says
// they're no longer where we have them.
function updateSteps() {
  if (readStep('still_here') === 'no') return UPDATE;
  return UPDATE.filter(function (step) { return step.key !== 'location' && step.key !== 'office'; });
}

// Begin the update questions and return the page to go to. `reason` is 'stale'
// (the 90-day sign-in check) or 'manual'; `returnTo` is where finishing lands.
function startUpdate(reason, returnTo) {
  ['still_here', 'procedures_saved', 'procedures_draft'].forEach(function (key) { saveStep(key, null); });
  saveStep('updating', true);
  saveStep('update_reason', reason);
  saveStep('update_return', returnTo);
  return UPDATE[0].page;
}

// True when the recorded sign-in (an ISO time) is more than STALE_SIGN_IN_DAYS
// ago. No record counts as recent: the first sign-in just records one.
function signInIsStale(lastSignInAt) {
  const time = Date.parse(lastSignInAt || '');
  if (Number.isNaN(time)) return false;
  return Date.now() - time > STALE_SIGN_IN_DAYS * 24 * 60 * 60 * 1000;
}

function answeredSteps() {
  const location = readStep('location');
  const user = readStep('user');
  return {
    user: user,
    email: user || readStep('signup_email'),
    // The password step creates the account, so it's answered once someone is signed in.
    password: user,
    name: readStep('name'),
    company: readStep('company'),
    procedures: readStep('procedures_saved'),
    'location-check': readStep('still_here'),
    location: location && location.state ? location : null,
    office: readStep('office'),
    category: readStep('category'),
    procedure: readStep('procedure'),
    timing: readStep('timing'),
  };
}

// Send the user to the first of `steps` ({ key, page }) without an answer.
// Returns the saved answers, or null when the page is redirecting away.
function requireAnswered(steps) {
  const saved = answeredSteps();
  const missing = steps.find(function (step) { return !saved[step.key]; });
  if (missing) {
    window.location.replace(missing.page);
    return null;
  }
  return saved;
}

// Send the user back to the first of `keys` they haven't answered yet. Being
// signed in is always required, so callers don't list 'user'.
// Returns the saved answers, or null when the page is redirecting away.
function requireSteps(keys) {
  return requireAnswered(FLOW.filter(function (step) {
    return step.key === 'user' || keys.indexOf(step.key) !== -1;
  }));
}

function categoryById(id) {
  return CATEGORIES.find(function (c) { return c.id === id; }) || null;
}

function stateName(code) {
  const match = STATES.find(function (s) { return s.code === code; });
  return match ? match.name : code;
}

// "Texas 78701" from a saved location.
function formatLocation(location) {
  const name = stateName(location.state);
  return location.zip ? name + ' ' + location.zip : name;
}

// State codes whose ZIP prefixes include this ZIP. Empty when no state claims it.
function statesForZip(zip) {
  const prefix = Number(zip.slice(0, 3));
  return Object.keys(ZIP_PREFIXES).filter(function (code) {
    return ZIP_PREFIXES[code].some(function (range) {
      return prefix >= range[0] && prefix <= range[1];
    });
  });
}

// False only when the ZIP clearly belongs to other states. Unclaimed prefixes
// pass, since we can't say they're wrong. This checks consistency with the
// state, not that the ZIP exists.
function zipFitsState(zip, stateCode) {
  const owners = statesForZip(zip);
  return owners.length === 0 || owners.indexOf(stateCode) !== -1;
}

function labelFor(items, id) {
  const match = items.find(function (item) { return item.id === id; });
  return match ? match.label : id;
}

// The offices the backend returned for the user's location (see api.js).
function savedOffices() {
  return readStep('offices') || [];
}

// The chosen office's name, falling back to its id if the list is gone.
function officeLabel(id) {
  const match = savedOffices().find(function (o) { return o.id === id; });
  return match ? match.name : id;
}

// Emergency work skips the timing step, so the flow is one step shorter.
function totalSteps() {
  const category = categoryById(readStep('category'));
  return category && category.skipTiming ? 4 : 5;
}

// The steps of the flow the user is on: the new-user or update questions while
// one is under way, otherwise the intake steps (signing in isn't counted as one).
function activeSteps() {
  if (inOnboarding()) return ONBOARDING;
  if (inUpdate()) return updateSteps();
  return FLOW.filter(function (step) { return step.key !== 'user'; });
}

function isLastStep(key) {
  const steps = activeSteps();
  return steps.length > 0 && steps[steps.length - 1].key === key;
}

// The page after step `key` in the flow the user is on. After the last sign-up
// question the intake picks up at the category step; after the last update
// question the user goes back to where the update started.
function nextPage(key) {
  const steps = activeSteps();
  const next = steps[steps.findIndex(function (step) { return step.key === key; }) + 1];
  if (next) return next.page;
  if (inOnboarding()) return 'category.html';
  if (inUpdate()) return readStep('update_return') || 'office.html';
  return null;
}

// Fill in the "Step 2 of 4" label and the progress bar at the top of the card,
// counting step `key` within the flow the user is on.
function renderStep(key) {
  const steps = activeSteps();
  const current = steps.findIndex(function (step) { return step.key === key; }) + 1;
  const total = inOnboarding() || inUpdate() ? steps.length : totalSteps();
  const label = document.getElementById('step-label');
  const fill = document.getElementById('progress');
  if (label) label.textContent = 'Step ' + current + ' of ' + total;
  if (fill) fill.style.width = Math.round((current / total) * 100) + '%';
}

// Show `message` under a form field, or hide it when the message is empty.
function setFieldError(input, errorElement, message) {
  errorElement.textContent = message;
  errorElement.hidden = !message;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

// Friendly text for the Firebase Auth errors people actually run into, or
// `fallback` for anything else.
function authMessage(error, fallback) {
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
    case 'auth/operation-not-allowed':
      return 'Email and password sign-in isn\'t enabled for this Firebase project.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment, then try again.';
    case 'auth/network-request-failed':
      return 'We couldn\'t reach the sign-in service. Check your connection and try again.';
    default:
      return fallback;
  }
}

// Fill a summary row, hiding the whole row when there is nothing to show.
function renderSummary(id, text) {
  const target = document.getElementById(id);
  if (!target) return;
  if (text) {
    target.textContent = text;
  } else {
    const row = target.closest('.summary');
    if (row) row.hidden = true;
  }
}

// Build one keyboard-accessible radio card per item.
function renderRadioCards(container, name, items) {
  items.forEach(function (item) {
    const label = document.createElement('label');
    label.className = 'option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = item.id;

    const body = document.createElement('span');
    body.className = 'option-body';

    const title = document.createElement('span');
    title.className = 'option-title';
    title.textContent = item.label;

    const desc = document.createElement('span');
    desc.className = 'option-desc';
    desc.textContent = item.description;

    body.append(title, desc);
    label.append(input, body);
    container.appendChild(label);
  });
}

// The two radio cards of a yes/no question, for renderRadioCards.
function yesNoOptions(yesLabel, yesDescription, noLabel, noDescription) {
  return [
    { id: 'yes', label: yesLabel, description: yesDescription },
    { id: 'no', label: noLabel, description: noDescription },
  ];
}

// Wire a radio-card form: preselect any saved answer, keep the button in step,
// and hand the chosen id and the button to onSubmit.
function setupChoiceForm(form, button, name, savedId, onSubmit) {
  if (savedId) form.elements[name].value = savedId;
  button.disabled = !form.elements[name].value;

  form.addEventListener('change', function () {
    button.disabled = !form.elements[name].value;
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const id = form.elements[name].value;
    if (id) onSubmit(id, button);
  });
}

// Show who is signed in, with a sign-out link, at the right of the page header.
// Runs on every page that loads this file and has the header.
function renderAccount() {
  const user = readStep('user');
  const header = document.querySelector('.brand');
  if (!user || !header) return;

  const wrapper = document.createElement('span');
  wrapper.className = 'brand-user';

  const name = document.createElement('strong');
  name.className = 'brand-username';
  name.textContent = user;

  const link = document.createElement('a');
  link.className = 'link';
  link.href = 'index.html';
  link.textContent = 'Sign out';
  link.addEventListener('click', async function (event) {
    event.preventDefault();
    await signOut();
    window.location.href = link.href;
  });

  wrapper.append(name, ' \u00b7 ');

  // Update recent procedures and location at any time, then come back here.
  // Not offered in the middle of sign-up or of an update.
  if (!inOnboarding() && !inUpdate()) {
    const update = document.createElement('a');
    update.className = 'link';
    update.href = UPDATE[0].page;
    update.textContent = 'Update info';
    update.addEventListener('click', function (event) {
      event.preventDefault();
      const here = window.location.pathname.split('/').pop() || 'office.html';
      window.location.href = startUpdate('manual', here + window.location.search);
    });
    wrapper.append(update, ' \u00b7 ');
  }

  wrapper.append(link);
  header.appendChild(wrapper);
}

if (typeof document !== 'undefined') renderAccount();
