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
  mode: 'local_demo',
  endpoint: '/api/chat',
  profileEndpoint: '/api/me',
  timeoutMs: 18000,
  profileDetailsLive: false,
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
  if (response.status === 422) {
    const data = await response.json().catch(() => ({}));
    throw new RejectedError(data.error || 'That was not accepted. Check your answer.');
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
  let profile;
  let usingLocalProfile = demoLoginActive();
  if (usingLocalProfile) {
    profile = demoProfile();
  } else {
    try {
      profile = await apiFetch(API_CONFIG.profileEndpoint, 'GET');
    } catch (error) {
      if (!(error instanceof AppServiceError)) throw error;
      console.warn("Profile API unavailable; using this browser's saved profile.", error);
      profile = demoProfile();
      usingLocalProfile = true;
    }
  }
  if (profileDetailsSent() && !usingLocalProfile) return profile;
  return { name: null, company: null, office: null, ...profile, ...localDetails(profile.email) };
}

export async function saveProfileLocation(state, zip) {
  if (demoLoginActive()) return saveDemoLocation(state, zip);
  try {
    return await apiFetch(`${API_CONFIG.profileEndpoint}/location`, 'PUT', { state, zip });
  } catch (error) {
    if (!(error instanceof AppServiceError)) throw error;
    console.warn('Profile API unavailable; saving location in this browser.', error);
    return saveDemoLocation(state, zip);
  }
}

async function proposedRoute(method, path, body, fallback) {
  if (profileDetailsSent()) {
    try {
      return await apiFetch(`${API_CONFIG.profileEndpoint}${path}`, method, body);
    } catch (error) {
      if (!(error instanceof AppServiceError)) throw error;
      console.warn('Profile API unavailable; using this browser instead.', error);
    }
  }
  return fallback();
}

export function saveProfileDetails(details) {
  return proposedRoute('PATCH', '', details, () => saveLocalDetails(details));
}

export async function fetchProcedures() {
  const result = await proposedRoute('GET', '/procedures', undefined, () => ({
    procedures: localDetails(readStep('user')).procedures || [],
  }));
  return result.procedures || [];
}

export function saveProcedures(entries) {
  return proposedRoute('POST', '/procedures', { procedures: entries }, () => {
    const now = new Date().toISOString();
    const recorded = entries.map((entry, index) => ({
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
  console.info(`[local_demo] ${message.event.name}`, message);
  const response = { session_id: message.session_id || id };
  if (message.event.name === STEP_EVENTS.location) {
    response.offices = placeholderOffices(message.event.parameters);
  }
  return response;
}

export async function sendStep(step, parameters, autoSet = false) {
  const message = buildStepMessage(step, parameters, autoSet);
  const response = API_CONFIG.mode === 'live'
    ? await apiFetch(API_CONFIG.endpoint, 'POST', message)
    : acknowledgeLocally(message);
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
      (error.status ? ` (HTTP ${error.status})` : '') + '. Start the backend, then try again.';
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

const ESTIMATE_DEFAULTS = { planId: 'C0', memberType: 'adult', network: 'in_network' };

export async function requestEstimate(intakeProcedureId, options = {}) {
  const engineId = PROCEDURE_TO_ENGINE[intakeProcedureId];
  if (!engineId) throw new Error('unmapped-procedure');
  const body = {
    plan_id: options.planId || ESTIMATE_DEFAULTS.planId,
    member_type: options.memberType || ESTIMATE_DEFAULTS.memberType,
    network: options.network || ESTIMATE_DEFAULTS.network,
    procedures: [engineId],
  };
  if (API_CONFIG.mode === 'live') {
    const response = await fetch('/api/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(API_CONFIG.timeoutMs),
    });
    if (!response.ok) throw new Error(`Estimate failed with status ${response.status}`);
    return response.json();
  }
  return localDemoEstimate(engineId, body);
}

function localDemoEstimate(engineId, body) {
  const allowedByProcedure = {
    cleaning: 95, 'exam-xrays': 120, filling: 200, extraction: 250,
    'root-canal': 1000, 'crown-bridge': 1200, implant: 3000, dentures: 1800,
    orthodontics: 5500, cosmetic: 600,
  };
  const categories = {
    cleaning: 'preventive', 'exam-xrays': 'preventive', filling: 'basic', extraction: 'basic',
    'root-canal': 'major', 'crown-bridge': 'major', implant: 'major', dentures: 'major',
    orthodontics: 'orthodontic', cosmetic: 'cosmetic',
  };
  const rates = { preventive: 1, basic: 0.8 };
  const category = categories[engineId] || 'basic';
  const allowed = allowedByProcedure[engineId] || 0;
  const rate = rates[category] || 0;
  const planPays = Math.round(allowed * rate * 100) / 100;
  const employeeOwes = Math.round((allowed - planPays) * 100) / 100;
  const line = {
    procedure_id: engineId,
    label: engineId,
    category,
    network: body.network,
    allowed_amount: allowed,
    deductible_applied: 0,
    plan_pays: planPays,
    employee_owes: employeeOwes,
    coverage_rate: rate,
    covered: rate > 0,
    reasons: rate > 0 ? [] : [`This plan does not cover ${category} services.`],
  };
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
