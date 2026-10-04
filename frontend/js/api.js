// Keeps the old intake wizard's step events in browser session storage.
// Profile and confirmed-care requests use authenticated cloud API routes.
// Loaded after shared.js on every page that collects an answer.
//
// A message looks like this. session_id is left out until the backend hands one
// back, and auto_set appears only when the app chose the value, not the user:
//   { "session_id": "...",
//     "event": { "name": "intake.timing", "parameters": { "timing": "asap" } },
//     "auto_set": true }
//
// The backend answers every message with JSON containing session_id. The answer
// to intake.location also carries `offices`, the dentist offices to choose from.
// See docs/frontend_json.md for every message and what the backend must return.
//
// The event names and this shape are a proposal. specs/001-dental-benefits-assistant/
// contracts/api.md defines POST /api/chat as taking one of `text` or `event`, but
// doesn't define these step events, so reconcile them with the Dialogflow flow.
//
// Every cloud API call carries the signed-in user's Firebase ID token.

const API_CONFIG = {
  // 'browser_intake': wizard steps stay in browser session storage.
  // 'live': POST each message to `endpoint` on the same origin.
  // The intake messages go to POST /api/chat, which the backend does not
  // implement yet. Profile, care and estimate routes are live regardless.
  mode: 'browser_intake',
  endpoint: '/api/chat',
  profileEndpoint: '/api/me',
  timeoutMs: 18000, // the docs set an 18-second frontend deadline
  // Authenticated profile and confirmed-care routes are deployed with Flask.
  profileDetailsLive: true,
};

// The backend says nobody is signed in (401), or Firebase has no user.
class SignedOutError extends Error {}

// The backend rejected the input (422). The message is safe to show the user.
class RejectedError extends Error {}

// The app API could not be reached or returned an unexpected error.
class AppServiceError extends Error {
  constructor(status, options) {
    super(status ? 'App API request failed with status ' + status : 'App API is unavailable', options);
    this.name = 'AppServiceError';
    this.status = status;
  }
}

const STEP_EVENTS = {
  location: 'intake.location',
  office: 'intake.office',
  category: 'intake.category',
  procedure: 'intake.procedure',
  timing: 'intake.timing',
};

function buildStepMessage(step, parameters, autoSet) {
  const message = {};
  const sessionId = readStep('session_id');
  if (sessionId) message.session_id = sessionId;
  message.event = { name: STEP_EVENTS[step], parameters: parameters };
  if (autoSet) message.auto_set = true;
  return message;
}

// Call a backend route as the signed-in user and return the JSON response.
async function apiFetch(path, method, body) {
  if (!window.appAuth) throw new Error('Sign-in did not load');
  const token = await window.appAuth.idToken();
  if (!token) throw new SignedOutError('Not signed in');

  const headers = { Authorization: 'Bearer ' + token };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(path, {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(API_CONFIG.timeoutMs),
    });
  } catch (error) {
    throw new AppServiceError(null, { cause: error });
  }
  if (response.status === 401) throw new SignedOutError('Sign-in rejected');
  if (response.status === 422 || response.status === 409) {
    const data = await response.json().catch(function () { return {}; });
    throw new RejectedError(data.error || 'That was not accepted. Check your answer.');
  }
  if (!response.ok) throw new AppServiceError(response.status);
  return response.json();
}

// True when name, company and office go to the backend rather than this browser.
function profileDetailsSent() {
  return API_CONFIG.profileDetailsLive && !demoLoginActive();
}

// { uid, email, name, company, office, location: { state, zip } or null }
async function fetchProfile() {
  let profile;
  let usingLocalProfile = demoLoginActive();
  if (usingLocalProfile) {
    profile = demoProfile();
  } else {
    profile = await apiFetch(API_CONFIG.profileEndpoint, 'GET');
  }
  if (profileDetailsSent() && !usingLocalProfile) return profile;
  return Object.assign({ name: null, company: null, office: null }, profile, localDetails(profile.email));
}

// Save the user's location so later sign-ins don't ask again. Returns the profile.
async function saveProfileLocation(state, zip) {
  if (demoLoginActive()) return saveDemoLocation(state, zip);
  return apiFetch(API_CONFIG.profileEndpoint + '/location', 'PUT', { state: state, zip: zip });
}

// Call a profile route. The local branch exists only for the explicit demo-login
// development mode; the production app propagates cloud errors.
async function proposedRoute(method, path, body, fallback) {
  if (profileDetailsSent()) {
    return apiFetch(API_CONFIG.profileEndpoint + path, method, body);
  }
  return fallback();
}

// Save some of the new-user answers to the profile: any of { name, company, office }.
function saveProfileDetails(details) {
  return proposedRoute('PATCH', '', details, function () { saveLocalDetails(details); });
}

// The procedures the user has recorded: [{ id, procedure, category, date,
// cost, you_paid, insurance_paid, recorded_at }].
async function fetchProcedures(employeeId) {
  const path = '/procedures?employee_id=' + encodeURIComponent(employeeId);
  const result = await proposedRoute('GET', path, undefined, function () {
    return { procedures: localDetails(readStep('user')).procedures || [] };
  });
  return result.procedures || [];
}

// Record recent procedures: [{ procedure, category, date, cost, you_paid,
// insurance_paid }]. An empty list records that there's nothing new.
function saveProcedures(entries, employeeId) {
  if (!entries.length) return Promise.resolve({ procedures: [] });
  return proposedRoute('POST', '/procedures', { employee_id: employeeId, procedures: entries }, function () {
    const now = new Date().toISOString();
    const recorded = entries.map(function (entry, i) {
      return Object.assign({ id: Date.now() + '-' + i, recorded_at: now }, entry);
    });
    const earlier = localDetails(readStep('user')).procedures || [];
    saveLocalDetails({ procedures: earlier.concat(recorded) });
  });
}

// The user's dental appointments: { appointments: [{ id, starts_at, office_name,
// reason }], sample }. `sample` is true for the placeholders shown while the
// route isn't live and none are stored in this browser.
async function fetchAppointments() {
  const stored = localDetails(readStep('user')).appointments;
  const result = { appointments: stored || sampleAppointments(), sample: !stored };
  return { appointments: result.appointments || [], sample: !!result.sample };
}

// SAMPLE_APPOINTMENTS dated from today, at the user's chosen office.
function sampleAppointments() {
  const office = readStep('office');
  const officeName = office ? officeLabel(office) : 'Your dental office';
  return SAMPLE_APPOINTMENTS.map(function (a, i) {
    const when = new Date();
    when.setDate(when.getDate() + a.daysFromNow);
    when.setHours(a.hour, a.minute, 0, 0);
    return { id: 'sample-' + i, starts_at: when.toISOString(), office_name: officeName, reason: a.reason };
  });
}

// Record that the user signed in now. The next sign-in compares against it for
// the 90-day update check (profile.last_sign_in_at).
function recordSignIn() {
  return proposedRoute('POST', '/sign-in', {}, function () {
    saveLocalDetails({ last_sign_in_at: new Date().toISOString() });
  });
}

// Wrap up the sign-up or update questions once the last answer is saved. An
// update records the sign-in only now, so one that's abandoned is asked again.
async function finishFlow() {
  if (inUpdate()) await recordSignIn();
  ['onboarding', 'updating', 'update_reason', 'update_return', 'previous_sign_in',
    'still_here', 'procedures_saved', 'procedures_draft'].forEach(function (key) { saveStep(key, null); });
}

// TEMPORARY stand-in for the proposed profile routes until profileDetailsLive
// is on: each email's name, company, office, procedures and last sign-in in
// this browser's localStorage.
const LOCAL_DETAILS_KEY = 'profile_details';

function readAllLocalDetails() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_DETAILS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function localDetails(email) {
  return readAllLocalDetails()[(email || '').toLowerCase()] || {};
}

function saveLocalDetails(details) {
  const all = readAllLocalDetails();
  const email = (readStep('user') || '').toLowerCase();
  all[email] = Object.assign({}, all[email], details);
  try {
    localStorage.setItem(LOCAL_DETAILS_KEY, JSON.stringify(all));
  } catch (e) { /* ignore: these are asked for again next time */ }
}

// Keep locations in this browser for UI demo mode and when the profile API is
// unavailable. Each email's location is still asked for only once per browser.
const DEMO_PROFILES_KEY = 'demo_profiles';

function readDemoProfiles() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_PROFILES_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function demoProfile() {
  const email = readStep('user') || '';
  const location = readDemoProfiles()[email.toLowerCase()] || null;
  return { uid: 'demo:' + email, email: email, location: location };
}

function saveDemoLocation(state, zip) {
  const profiles = readDemoProfiles();
  profiles[(readStep('user') || '').toLowerCase()] = { state: state, zip: zip };
  try {
    localStorage.setItem(DEMO_PROFILES_KEY, JSON.stringify(profiles));
  } catch (e) { /* ignore: the location is asked for again next time */ }
  return demoProfile();
}

function postMessage(message) {
  return apiFetch(API_CONFIG.endpoint, 'POST', message);
}

// Stand-in for the backend: hands back a session the first time, like the real one will.
function acknowledgeLocally(message) {
  const id = window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);
  console.info('[browser_intake] ' + message.event.name, message);
  const response = { session_id: message.session_id || id };
  if (message.event.name === STEP_EVENTS.location) {
    response.offices = placeholderOffices(message.event.parameters);
  }
  return response;
}

// Fictional offices dressed up with the user's own state and ZIP.
function placeholderOffices(location) {
  const place = stateName(location.state) + (location.zip ? ' ' + location.zip : '');
  return LOCAL_DEMO_OFFICES.map(function (o) {
    return { id: o.id, name: o.name, address: o.street + ', ' + place, distance_miles: o.distance_miles };
  });
}

// Keep a record of what was sent so the temporary summary page can show it.
function logSent(message) {
  const log = readStep('sent_log') || [];
  log.push({ mode: API_CONFIG.mode, request: message });
  saveStep('sent_log', log);
}

// Keep what the backend handed back. The location response lists the offices to
// choose from; if the user's earlier pick isn't among the new ones, forget it.
function handleResponse(step, response) {
  if (!response) return;
  if (response.session_id) saveStep('session_id', response.session_id);
  if (step === 'location') {
    const offices = Array.isArray(response.offices) ? response.offices : [];
    saveStep('offices', offices);
    const chosen = readStep('office');
    if (chosen && !offices.some(function (o) { return o.id === chosen; })) saveStep('office', null);
  }
}

async function sendStep(step, parameters, autoSet) {
  const message = buildStepMessage(step, parameters, autoSet);
  const response = API_CONFIG.mode === 'live' ? await postMessage(message) : acknowledgeLocally(message);
  handleResponse(step, response);
  logSent(message);
}

function showSendError(button, text) {
  let error = document.getElementById('send-error');
  if (!error) {
    if (!text) return;
    error = document.createElement('p');
    error.id = 'send-error';
    error.className = 'error';
    error.setAttribute('role', 'alert');
    button.insertAdjacentElement('afterend', error);
  }
  error.textContent = text;
  error.hidden = !text;
}

// Run `work` (an async function), then go to `page`, or to the page `work`
// returns instead. If it fails, stay on the page with a retry message so the
// user's answer isn't silently lost. If the user turns out to be signed out,
// send them back to sign in.
async function submitThenGo(button, work, page) {
  button.disabled = true;
  showSendError(button, '');
  let destination;
  try {
    destination = await work();
  } catch (e) {
    if (e instanceof SignedOutError) {
      await signOut();
      window.location.href = 'index.html?signed-out=1';
      return;
    }
    button.disabled = false;
    showSendError(button, e instanceof RejectedError
      ? e.message
      : e instanceof AppServiceError
        ? 'The cloud service could not save or load this information'
          + (e.status ? ' (HTTP ' + e.status + ')' : '')
          + '. Please try again when the cloud service is available.'
      : "We couldn't send that just now. Please try again.");
    return;
  }
  window.location.href = destination || page;
}

// Send each piece in order, then go to `page`.
// A piece is { step, parameters, autoSet }.
function sendSteps(button, pieces, page) {
  return submitThenGo(button, async function () {
    for (const piece of pieces) {
      await sendStep(piece.step, piece.parameters, piece.autoSet);
    }
  }, page);
}
