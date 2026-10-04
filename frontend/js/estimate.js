// Coverage estimate — talks to the backend engine's POST /api/estimate.
//
// Kept in its own file (not api.js) so it survives rewrites of the intake/auth
// layer. Loaded after api.js on results.html; it reuses API_CONFIG for the
// mode flag and request timeout, but the estimate endpoint needs no sign-in
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
// In 'live' mode (API_CONFIG.mode) this POSTs to the backend server. In
// 'local_demo' mode nothing leaves the browser and a deterministic placeholder
// estimate is built locally so the page is demonstrable offline. If the live
// call fails to reach the server, it falls back to the local estimate flagged
// as approximate rather than erroring out.
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

  const mode = (typeof API_CONFIG !== 'undefined' && API_CONFIG.mode) || 'local_demo';
  if (mode !== 'live') {
    return localDemoEstimate(engineId, body);
  }

  const timeoutMs = (typeof API_CONFIG !== 'undefined' && API_CONFIG.timeoutMs) || 18000;
  let response;
  try {
    response = await fetch(ESTIMATE_DEFAULTS.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (networkError) {
    // Server unreachable (offline, not running): fall back to the local demo so
    // the page still shows something, clearly flagged as approximate.
    console.warn('[estimate] live request failed, using local demo', networkError);
    return localDemoEstimate(engineId, body);
  }

  if (!response.ok) {
    const data = await response.json().catch(function () { return {}; });
    throw new Error(data.error || 'Estimate failed with status ' + response.status);
  }
  return response.json();
}

// A stand-in estimate for local_demo (or offline) use: mirrors the engine's
// response shape (dollars) with rough catalog costs and plan A's adult coverage,
// so the results page renders without a backend. Clearly approximate.
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
