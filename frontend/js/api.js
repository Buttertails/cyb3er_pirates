// Sends each answered step to the backend as its own small JSON message, so a
// Dialogflow flow can take the answers one at a time instead of one big payload.
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
// Every backend call carries the signed-in user's Firebase ID token (see
// firebase.js). The profile routes (/api/me) are always live; the mode below only
// covers the intake.* messages.

const API_CONFIG = {
  // 'local_demo': nothing leaves the browser; messages are logged and acknowledged locally.
  // 'live': POST each message to `endpoint` on the same origin.
  mode: 'live',
  endpoint: '/api/chat',
  profileEndpoint: '/api/me',
  timeoutMs: 18000, // the docs set an 18-second frontend deadline
  // TEMPORARY: the backend has no route yet for the new-user answers it can't
  // store (name, company, office; PATCH /api/me in docs/frontend_json.md). While
  // this is false they're kept per email in this browser. Set it to true once
  // the route exists.
  profileDetailsLive: false,
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
  if (response.status === 422) {
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
    try {
      profile = await apiFetch(API_CONFIG.profileEndpoint, 'GET');
    } catch (error) {
      if (!(error instanceof AppServiceError)) throw error;
      console.warn('Profile API unavailable; using this browser\'s saved profile.', error);
      profile = demoProfile();
      usingLocalProfile = true;
    }
  }
  if (profileDetailsSent() && !usingLocalProfile) return profile;
  return Object.assign({ name: null, company: null, office: null }, profile, localDetails(profile.email));
}

// Save the user's location so later sign-ins don't ask again. Returns the profile.
async function saveProfileLocation(state, zip) {
  if (demoLoginActive()) return saveDemoLocation(state, zip);
  try {
    return await apiFetch(API_CONFIG.profileEndpoint + '/location', 'PUT', { state: state, zip: zip });
  } catch (error) {
    if (!(error instanceof AppServiceError)) throw error;
    console.warn('Profile API unavailable; saving location in this browser.', error);
    return saveDemoLocation(state, zip);
  }
}

// Save some of the new-user answers to the profile: any of { name, company, office }.
function saveProfileDetails(details) {
  if (profileDetailsSent()) {
    return apiFetch(API_CONFIG.profileEndpoint, 'PATCH', details).catch(function (error) {
      if (!(error instanceof AppServiceError)) throw error;
      console.warn('Profile API unavailable; saving profile details in this browser.', error);
      saveLocalDetails(details);
    });
  }
  saveLocalDetails(details);
  return Promise.resolve();
}

// TEMPORARY stand-in for PATCH /api/me until profileDetailsLive is on: each
// email's name, company and office in this browser's localStorage.
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
  console.info('[local_demo] ' + message.event.name, message);
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
        ? 'Sign-in succeeded, but the app couldn\'t load your profile'
          + (e.status ? ' (HTTP ' + e.status + ')' : '')
          + '. Start the Firebase Hosting and Functions backend, then try again.'
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

// --------------------------------------------------------------------------- #
// Coverage estimate (the engine's /api/estimate endpoint)
// --------------------------------------------------------------------------- #
//
// The intake flow collects procedure ids that are friendlier/broader than the
// engine's catalog (e.g. "deep-cleaning", or emergency symptoms like
// "broken-tooth"). PROCEDURE_TO_ENGINE maps each intake id to the closest
// catalog procedure the engine can price. Ids already in the catalog map to
// themselves.
const PROCEDURE_TO_ENGINE = {
  // Already catalog ids.
  cleaning: 'cleaning',
  'exam-xrays': 'exam-xrays',
  filling: 'filling',
  extraction: 'extraction',
  'root-canal': 'root-canal',
  'crown-bridge': 'crown-bridge',
  implant: 'implant',
  dentures: 'dentures',
  orthodontics: 'orthodontics',
  cosmetic: 'cosmetic',
  // Broader intake ids mapped to the nearest priced procedure.
  'deep-cleaning': 'cleaning',
  other: 'exam-xrays',
  // Emergency symptoms -> the procedure most likely to address them. These are
  // best-effort for an estimate, not a diagnosis.
  'severe-pain': 'exam-xrays',
  'broken-tooth': 'crown-bridge',
  swelling: 'extraction',
  'lost-filling': 'filling',
  bleeding: 'exam-xrays',
  'urgent-other': 'exam-xrays',
};

// The demo plan the estimate runs against until plan selection is part of the
// intake. "C0" is company plan A (adult); see Data/plans.json.
const ESTIMATE_DEFAULTS = {
  planId: 'C0',
  memberType: 'adult',
  network: 'in_network',
};

// Map an intake procedure id to the engine catalog id, or null if we can't.
function engineProcedureId(intakeProcedureId) {
  return PROCEDURE_TO_ENGINE[intakeProcedureId] || null;
}

// Ask the engine what a procedure costs under the demo plan. In local_demo mode
// nothing leaves the browser and a deterministic placeholder estimate is built
// locally so the page is still demonstrable offline.
async function requestEstimate(intakeProcedureId, options) {
  const opts = options || {};
  const engineId = engineProcedureId(intakeProcedureId);
  if (!engineId) {
    throw new Error('unmapped-procedure');
  }

  const body = {
    plan_id: opts.planId || ESTIMATE_DEFAULTS.planId,
    member_type: opts.memberType || ESTIMATE_DEFAULTS.memberType,
    network: opts.network || ESTIMATE_DEFAULTS.network,
    procedures: [engineId],
  };

  if (API_CONFIG.mode === 'live') {
    const response = await fetch('/api/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(API_CONFIG.timeoutMs),
    });
    if (!response.ok) throw new Error('Estimate failed with status ' + response.status);
    return response.json();
  }

  return localDemoEstimate(engineId, body);
}

// A stand-in estimate for local_demo mode: mirrors the engine's response shape
// (dollars) with rough catalog costs and plan A's adult coverage, so the
// results page renders without a backend. Clearly approximate.
function localDemoEstimate(engineId, body) {
  // Rough in-network allowed amounts (dollars), aligned with the backend catalog.
  const ALLOWED = {
    cleaning: 95, 'exam-xrays': 120, filling: 200, extraction: 250,
    'root-canal': 1000, 'crown-bridge': 1200, implant: 3000, dentures: 1800,
    orthodontics: 5500, cosmetic: 600,
  };
  // Plan A (adult) covers Routine (preventive) + Basic only; everything else 0.
  const CATEGORY = {
    cleaning: 'preventive', 'exam-xrays': 'preventive', filling: 'basic',
    extraction: 'basic', 'root-canal': 'major', 'crown-bridge': 'major',
    implant: 'major', dentures: 'major', orthodontics: 'orthodontic', cosmetic: 'cosmetic',
  };
  const RATE = { preventive: 1.0, basic: 0.8 }; // plan A adult; others uncovered
  const category = CATEGORY[engineId] || 'basic';
  const allowed = ALLOWED[engineId] || 0;
  const rate = RATE[category] || 0;
  const covered = rate > 0;
  const planPays = covered ? Math.round(allowed * rate * 100) / 100 : 0;
  const employeeOwes = Math.round((allowed - planPays) * 100) / 100;

  const line = {
    procedure_id: engineId,
    label: engineId,
    category: category,
    network: body.network,
    allowed_amount: allowed,
    deductible_applied: 0,
    plan_pays: planPays,
    employee_owes: employeeOwes,
    coverage_rate: rate,
    covered: covered,
    reasons: covered ? [] : ['This plan does not cover ' + category + ' services.'],
  };
  console.info('[local_demo] estimate', body, line);
  return {
    lines: [line],
    annual_maximum: 7500,
    annual_max_used_before: 0,
    annual_max_used_after: planPays,
    annual_max_remaining_after: Math.round((7500 - planPays) * 100) / 100,
    totals: { plan_pays: planPays, employee_owes: employeeOwes },
    _local_demo: true,
  };
}
