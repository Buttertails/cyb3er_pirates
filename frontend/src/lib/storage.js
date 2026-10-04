import {
  CATEGORIES,
  HISTORY_CATEGORIES,
  STATES,
  ZIP_PREFIXES,
} from '../../js/options.js';

export const ROUTES = {
  signIn: '/index.html',
  signup: '/signup.html',
  chat: '/chat',
  profile: '/profile.html',
  summary: '/summary.html',
};

// The one-question-per-page intake URLs, now answered in the chat. App.jsx
// redirects them so old links and bookmarks still land somewhere useful.
export const LEGACY_CHAT_PATHS = [
  '/location.html', '/office.html', '/category.html', '/procedure.html', '/timing.html',
  '/confirm.html', '/results.html', '/procedures.html', '/location-check.html',
];

export const FLOW = [
  { key: 'user', page: ROUTES.signIn },
  { key: 'location', page: ROUTES.chat },
  { key: 'office', page: ROUTES.chat },
  { key: 'category', page: ROUTES.chat },
  { key: 'procedure', page: ROUTES.chat },
  { key: 'timing', page: ROUTES.chat },
];

// Sign-up pages come first, then the chat asks for location and office.
export const ONBOARDING = [
  { key: 'email', page: `${ROUTES.signup}?q=email` },
  { key: 'password', page: `${ROUTES.signup}?q=password` },
  { key: 'name', page: `${ROUTES.signup}?q=name` },
  { key: 'company', page: `${ROUTES.signup}?q=company` },
  { key: 'location', page: ROUTES.chat },
  { key: 'office', page: ROUTES.chat },
];

export const UPDATE = [
  { key: 'procedures', page: ROUTES.chat },
  { key: 'location-check', page: ROUTES.chat },
  { key: 'location', page: ROUTES.chat },
  { key: 'office', page: ROUTES.chat },
];

export const STALE_SIGN_IN_DAYS = 90;
export const DEMO_LOGIN = false;

function storageEvent() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('session-change'));
}

export function readStep(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

export function saveStep(key, value) {
  try {
    if (value === null || value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
    storageEvent();
  } catch {
    // The next guarded route returns the user to the missing step.
  }
}

export function clearAnswers() {
  const retained = Object.fromEntries(
    ['user', 'name', 'company', 'demo_employee_id'].map((key) => [key, readStep(key)]));
  try { sessionStorage.clear(); } catch { /* storage can be unavailable */ }
  for (const [key, value] of Object.entries(retained)) {
    if (value) saveStep(key, value);
  }
  storageEvent();
}

export function clearSession() {
  try { sessionStorage.clear(); } catch { /* storage can be unavailable */ }
  storageEvent();
}

export function inOnboarding() {
  return readStep('onboarding') === true;
}

export function inUpdate() {
  return readStep('updating') === true;
}

export function updateSteps() {
  if (readStep('still_here') === 'no') return UPDATE;
  return UPDATE.filter((step) => step.key !== 'location' && step.key !== 'office');
}

// Returns a fresh /chat URL each time so an open chat restarts on the update questions.
export function startUpdate(reason, returnTo) {
  ['still_here', 'procedures_saved', 'procedures_draft', 'work_entry', 'chat_node']
    .forEach((key) => saveStep(key, null));
  saveStep('updating', true);
  saveStep('update_reason', reason);
  saveStep('update_return', returnTo);
  return `${UPDATE[0].page}?update=${Date.now()}`;
}

export function signInIsStale(lastSignInAt) {
  const time = Date.parse(lastSignInAt || '');
  if (Number.isNaN(time)) return false;
  return Date.now() - time > STALE_SIGN_IN_DAYS * 24 * 60 * 60 * 1000;
}

export function answeredSteps() {
  const location = readStep('location');
  const user = readStep('user');
  return {
    user,
    email: user || readStep('signup_email'),
    password: user,
    name: readStep('name'),
    company: readStep('company'),
    procedures: readStep('procedures_saved'),
    'location-check': readStep('still_here'),
    location: location?.state ? location : null,
    office: readStep('office'),
    category: readStep('category'),
    procedure: readStep('procedure'),
    timing: readStep('timing'),
  };
}

export function firstMissing(steps) {
  const saved = answeredSteps();
  const missing = steps.find((step) => !saved[step.key]);
  return { saved, missing };
}

export function requiredFlow(keys) {
  return FLOW.filter((step) => step.key === 'user' || keys.includes(step.key));
}

export function categoryById(id) {
  return CATEGORIES.find((category) => category.id === id) || null;
}

export function stateName(code) {
  return STATES.find((state) => state.code === code)?.name || code;
}

export function formatLocation(location) {
  if (!location) return '';
  const name = stateName(location.state);
  return location.zip ? `${name} ${location.zip}` : name;
}

export function statesForZip(zip) {
  const prefix = Number(zip.slice(0, 3));
  return Object.keys(ZIP_PREFIXES).filter((code) =>
    ZIP_PREFIXES[code].some(([low, high]) => prefix >= low && prefix <= high));
}

export function zipFitsState(zip, stateCode) {
  const owners = statesForZip(zip);
  return owners.length === 0 || owners.includes(stateCode);
}

export function labelFor(items, id) {
  return items.find((item) => (item.id ?? item.code) === id)?.label || id;
}

export function savedOffices() {
  return readStep('offices') || [];
}

export function officeLabel(id) {
  return savedOffices().find((office) => office.id === id)?.name || id;
}

export function totalSteps() {
  return categoryById(readStep('category'))?.skipTiming ? 4 : 5;
}

export function activeSteps() {
  if (inOnboarding()) return ONBOARDING;
  if (inUpdate()) return updateSteps();
  return FLOW.filter((step) => step.key !== 'user');
}

export function isLastStep(key) {
  const steps = activeSteps();
  return steps.at(-1)?.key === key;
}

export function nextPage(key) {
  const steps = activeSteps();
  const next = steps[steps.findIndex((step) => step.key === key) + 1];
  if (next) return next.page;
  if (inOnboarding() || inUpdate()) return ROUTES.chat;
  return null;
}

export function stepPosition(key) {
  const steps = activeSteps();
  const current = steps.findIndex((step) => step.key === key) + 1;
  const total = inOnboarding() || inUpdate() ? steps.length : totalSteps();
  return { current, total };
}

export function dollars(value) {
  return Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatDay(iso) {
  const time = Date.parse(iso || '');
  if (Number.isNaN(time)) return '';
  return new Date(time).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

export function procedureLabel(id) {
  for (const category of HISTORY_CATEGORIES) {
    const match = category.procedures.find((procedure) => procedure.id === id);
    if (match) return match.label;
  }
  return id;
}

export function describeProcedure(entry) {
  const [year, month] = entry.date.split('-').map(Number);
  const when = new Date(year, month - 1).toLocaleDateString('en-US', {
    month: 'short', year: 'numeric',
  });
  const money = [];
  if (entry.cost != null) money.push(`${dollars(entry.cost)} total`);
  if (entry.you_paid != null) money.push(`you paid ${dollars(entry.you_paid)}`);
  if (entry.insurance_paid != null) money.push(`insurance paid ${dollars(entry.insurance_paid)}`);
  return [procedureLabel(entry.procedure), when, money.join(', ')].filter(Boolean).join(' · ');
}
