// Coverage estimate for the signed-in account's selected fictional employee.
//
// Loaded after api.js on results.html; it uses apiFetch for an authenticated
// request to the shared backend calculator.
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

const ESTIMATE_DEFAULTS = {
  network: 'in_network',
  endpoint: '/api/me/estimate',
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
  if (!opts.employeeId) throw new Error('select-employee');

  const body = {
    employee_id: opts.employeeId,
    procedure_id: engineId,
    network: opts.network || ESTIMATE_DEFAULTS.network,
  };
  const response = await apiFetch(ESTIMATE_DEFAULTS.endpoint, 'POST', body);
  return response.estimate;
}
