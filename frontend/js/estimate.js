// Coverage estimate — talks to the backend engine's POST /api/estimate.
//
// Loaded after api.js on results.html; it reuses API_CONFIG for the request
// timeout, but the estimate endpoint needs no sign-in
// (it runs purely from a plan id + procedures), so it uses a plain fetch.
//
// results.js calls requestEstimate(intakeProcedureId, options) and renders the
// response. The response shape mirrors the engine's Estimate.to_dict():
//   { lines: [{ allowed_amount, plan_pays, employee_owes, coverage_rate,
//               covered, deductible_applied, category, reasons[] }],
//     totals: { plan_pays, employee_owes },
//     annual_max_remaining_after, ... }

// The intake flow collects procedure ids that are friendlier/broader than the
// engine's catalog (e.g. "deep-cleaning", or emergency symptoms like
// "broken-tooth"). Map each to the closest catalog procedure the engine prices.
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
  // Emergency symptoms -> the procedure most likely to address them. Best-effort
  // for an estimate, not a diagnosis.
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
  endpoint: '/api/estimate',
};

// Map an intake procedure id to the engine catalog id, or null if we can't.
function engineProcedureId(intakeProcedureId) {
  return PROCEDURE_TO_ENGINE[intakeProcedureId] || null;
}

// Ask the engine what a procedure costs under the demo plan.
//
// Always POST to the backend. An unavailable backend is shown as an error by
// the results page so a local approximation cannot look like a cloud result.
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

  const timeoutMs = (typeof API_CONFIG !== 'undefined' && API_CONFIG.timeoutMs) || 18000;
  const response = await fetch(ESTIMATE_DEFAULTS.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const data = await response.json().catch(function () { return {}; });
    throw new Error(data.error || 'Estimate failed with status ' + response.status);
  }
  return response.json();
}
