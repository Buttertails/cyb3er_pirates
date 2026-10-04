import {
  LOCAL_DEMO_OFFICES,
  SAMPLE_APPOINTMENTS,
} from '../../js/options.js';
import { demoLoginActive, idToken } from './auth.js';
import {
  inUpdate,
  officeLabel,
  readStep,
  saveStep,
  stateName,
} from './storage.js';

export const API_CONFIG = {
  mode: 'browser_intake',
  endpoint: '/api/chat',
  profileEndpoint: '/api/me',
  timeoutMs: 18000,
  profileDetailsLive: true,
};

export class SignedOutError extends Error {}
export class RejectedError extends Error {}
export class AppServiceError extends Error {
  constructor(status, options) {
    super(status ? `App API request failed with status ${status}` : 'App API is unavailable', options);
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
  message.event = { name: STEP_EVENTS[step], parameters };
  if (autoSet) message.auto_set = true;
  return message;
}

async function apiFetch(path, method, body) {
  const token = await idToken();
  if (!token) throw new SignedOutError('Not signed in');

  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(API_CONFIG.timeoutMs),
    });
  } catch (error) {
    throw new AppServiceError(null, { cause: error });
  }
  if (response.status === 401) throw new SignedOutError('Sign-in rejected');
  if (response.status === 422 || response.status === 409) {
    const data = await response.json().catch(() => ({}));
    throw new RejectedError(typeof data.error === 'string' ? data.error : data.error?.message || 'That was not accepted. Check your answer.');
  }
  if (!response.ok) throw new AppServiceError(response.status);
  return response.json();
}

const LOCAL_DETAILS_KEY = 'profile_details';
const DEMO_PROFILES_KEY = 'demo_profiles';

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* best effort */ }
}

function localDetails(email) {
  return readJson(LOCAL_DETAILS_KEY)[(email || '').toLowerCase()] || {};
}

function saveLocalDetails(details) {
  const all = readJson(LOCAL_DETAILS_KEY);
  const email = (readStep('user') || '').toLowerCase();
  all[email] = { ...all[email], ...details };
  writeJson(LOCAL_DETAILS_KEY, all);
  return all[email];
}

function demoProfile() {
  const email = readStep('user') || '';
  const location = readJson(DEMO_PROFILES_KEY)[email.toLowerCase()] || null;
  return { uid: `demo:${email}`, email, location };
}

function saveDemoLocation(state, zip) {
  const profiles = readJson(DEMO_PROFILES_KEY);
  profiles[(readStep('user') || '').toLowerCase()] = { state, zip };
  writeJson(DEMO_PROFILES_KEY, profiles);
  return demoProfile();
}

function profileDetailsSent() {
  return API_CONFIG.profileDetailsLive && !demoLoginActive();
}

export async function fetchProfile() {
  const usingLocalProfile = demoLoginActive();
  const profile = usingLocalProfile ? demoProfile() : await apiFetch(API_CONFIG.profileEndpoint, 'GET');
  if (profileDetailsSent()) return profile;
  return { name: null, company: null, office: null, ...profile, ...localDetails(profile.email) };
}

export async function saveProfileLocation(state, zip) {
  if (demoLoginActive()) return saveDemoLocation(state, zip);
  return apiFetch(`${API_CONFIG.profileEndpoint}/location`, 'PUT', { state, zip });
}

async function proposedRoute(method, path, body, fallback) {
  if (profileDetailsSent()) {
    return apiFetch(`${API_CONFIG.profileEndpoint}${path}`, method, body);
  }
  return fallback();
}

export function saveProfileDetails(details) {
  return proposedRoute('PATCH', '', details, () => saveLocalDetails(details));
}

export async function fetchProcedures(employeeId) {
  if (!employeeId) throw new RejectedError('Select a fictional employee first.');
  const result = await proposedRoute('GET', `/procedures?employee_id=${encodeURIComponent(employeeId)}`, undefined, () => ({
    procedures: localDetails(readStep('user')).procedures || [],
  }));
  return result.procedures || [];
}

export function saveProcedures(entries, employeeId) {
  if (!entries.length) return Promise.resolve({ procedures: [] });
  if (!employeeId) throw new RejectedError('Select a fictional employee first.');
  const reports = entries.map((entry) => ({
    ...entry,
    submission_id: entry.submission_id || window.crypto?.randomUUID?.() || `care-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  }));
  return proposedRoute('POST', '/procedures', { employee_id: employeeId, procedures: reports }, () => {
    const now = new Date().toISOString();
    const recorded = reports.map((entry, index) => ({
      id: `${Date.now()}-${index}`, recorded_at: now, ...entry,
    }));
    const earlier = localDetails(readStep('user')).procedures || [];
    return saveLocalDetails({ procedures: earlier.concat(recorded) });
  });
}

function sampleAppointments() {
  const office = readStep('office');
  const officeName = office ? officeLabel(office) : 'Your dental office';
  return SAMPLE_APPOINTMENTS.map((appointment, index) => {
    const when = new Date();
    when.setDate(when.getDate() + appointment.daysFromNow);
    when.setHours(appointment.hour, appointment.minute, 0, 0);
    return {
      id: `sample-${index}`,
      starts_at: when.toISOString(),
      office_name: officeName,
      reason: appointment.reason,
    };
  });
}

export async function fetchAppointments() {
  const result = await proposedRoute('GET', '/appointments', undefined, () => {
    const stored = localDetails(readStep('user')).appointments;
    return { appointments: stored || sampleAppointments(), sample: !stored };
  });
  return { appointments: result.appointments || [], sample: Boolean(result.sample) };
}

export function recordSignIn() {
  return proposedRoute('POST', '/sign-in', {}, () =>
    saveLocalDetails({ last_sign_in_at: new Date().toISOString() }));
}

export async function fetchBenefits(employeeId) {
  if (!employeeId) throw new RejectedError('Select a fictional employee first.');
  return apiFetch(`/api/me/benefits?employee_id=${encodeURIComponent(employeeId)}`, 'GET');
}

export async function sendLiveChat(employeeId, sessionId, message) {
  if (!employeeId) throw new RejectedError('Select a fictional employee first.');
  const body = { employee_id: employeeId, ...(sessionId ? { session_id: sessionId } : {}), ...message };
  return apiFetch('/api/chat', 'POST', body);
}

export async function finishFlow() {
  if (inUpdate()) await recordSignIn();
  [
    'onboarding', 'updating', 'update_reason', 'update_return', 'previous_sign_in',
    'still_here', 'procedures_saved', 'procedures_draft',
  ].forEach((key) => saveStep(key, null));
}

function placeholderOffices(location) {
  const place = `${stateName(location.state)}${location.zip ? ` ${location.zip}` : ''}`;
  return LOCAL_DEMO_OFFICES.map((office) => ({
    id: office.id,
    name: office.name,
    address: `${office.street}, ${place}`,
    distance_miles: office.distance_miles,
  }));
}

function acknowledgeLocally(message) {
  const id = window.crypto?.randomUUID?.() || `${Date.now()}${Math.random().toString(16).slice(2)}`;
  // The scripted intake asks for location and office; these events are not part
  // of the Dialogflow contract. Only the verified profile and care routes write.
  const response = { session_id: message.session_id || id };
  if (message.event.name === STEP_EVENTS.location) {
    response.offices = placeholderOffices(message.event.parameters);
  }
  return response;
}

export async function sendStep(step, parameters, autoSet = false) {
  const message = buildStepMessage(step, parameters, autoSet);
  const response = acknowledgeLocally(message);
  if (response?.session_id) saveStep('session_id', response.session_id);
  if (step === 'location') {
    const offices = Array.isArray(response?.offices) ? response.offices : [];
    saveStep('offices', offices);
    const chosen = readStep('office');
    if (chosen && !offices.some((office) => office.id === chosen)) saveStep('office', null);
  }
  const log = readStep('sent_log') || [];
  saveStep('sent_log', log.concat({ mode: API_CONFIG.mode, request: message }));
}

export async function sendSteps(pieces) {
  for (const piece of pieces) {
    await sendStep(piece.step, piece.parameters, piece.autoSet);
  }
}

export function submitErrorMessage(error) {
  if (error instanceof RejectedError) return error.message;
  if (error instanceof AppServiceError) {
    return "The app couldn't load your profile" +
      (error.status ? ` (HTTP ${error.status})` : '') + '. Please try again.';
  }
  return "We couldn't send that just now. Please try again.";
}

const PROCEDURE_TO_ENGINE = {
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
  'deep-cleaning': 'cleaning',
  other: 'exam-xrays',
  'severe-pain': 'exam-xrays',
  'broken-tooth': 'crown-bridge',
  swelling: 'extraction',
  'lost-filling': 'filling',
  bleeding: 'exam-xrays',
  'urgent-other': 'exam-xrays',
};

export async function requestEstimate(intakeProcedureId, options = {}) {
  const engineId = PROCEDURE_TO_ENGINE[intakeProcedureId];
  if (!engineId) throw new Error('unmapped-procedure');
  if (!options.employeeId) throw new RejectedError('Select a fictional employee first.');
  const body = {
    employee_id: options.employeeId,
    procedure_id: engineId,
    network: options.network || 'in_network',
  };
  const result = await apiFetch('/api/me/estimate', 'POST', body);
  return result.estimate;
}

// Recommend when to do several procedures across the plan year to minimize the
// user's out-of-pocket cost. `intakeProcedureIds` are intake ids (mapped to the
// engine catalog here). `options.urgent` lists intake ids that must stay this
// year. Returns the backend's sequence result (schedule, savings, summary).
export async function requestSequence(intakeProcedureIds, options = {}) {
  if (!options.employeeId) throw new RejectedError('Select a fictional employee first.');
  const procedures = [];
  for (const id of intakeProcedureIds) {
    const engineId = PROCEDURE_TO_ENGINE[id];
    if (!engineId) throw new Error('unmapped-procedure');
    if (!procedures.includes(engineId)) procedures.push(engineId);
  }
  if (!procedures.length) throw new RejectedError('Choose at least one procedure to plan.');
  const urgent = (options.urgent || [])
    .map((id) => PROCEDURE_TO_ENGINE[id])
    .filter((engineId) => engineId && procedures.includes(engineId));
  const body = {
    employee_id: options.employeeId,
    procedures,
    network: options.network || 'in_network',
    ...(urgent.length ? { urgent } : {}),
  };
  const result = await apiFetch('/api/me/sequence', 'POST', body);
  return result.sequence;
}

// --- Saved estimates and sequence plans (kept on the user's profile) --------

function newRecordId() {
  return window.crypto?.randomUUID?.() || `saved-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Persist a snapshot of an estimate or sequence result. `kind` is 'estimate'
// or 'sequence'; `result` is the computed object the chat already rendered.
// Returns the stored record (with id + saved_at).
export async function saveSavedPlan({ employeeId, kind, result, label, id }) {
  if (!employeeId) throw new RejectedError('Select a fictional employee first.');
  const body = {
    employee_id: employeeId,
    id: id || newRecordId(),
    kind,
    result,
    ...(label ? { label } : {}),
  };
  const response = await apiFetch('/api/me/saved', 'POST', body);
  return response.saved;
}

export async function fetchSavedPlans(employeeId) {
  if (!employeeId) throw new RejectedError('Select a fictional employee first.');
  const response = await apiFetch(`/api/me/saved?employee_id=${encodeURIComponent(employeeId)}`, 'GET');
  return response.saved || [];
}

export async function deleteSavedPlan(id, employeeId) {
  if (!employeeId) throw new RejectedError('Select a fictional employee first.');
  const response = await apiFetch(
    `/api/me/saved/${encodeURIComponent(id)}?employee_id=${encodeURIComponent(employeeId)}`, 'DELETE');
  return response.deleted;
}
