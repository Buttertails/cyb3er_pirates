// Profile: what we have for the signed-in user (details, plan, appointments and
// recorded procedures), read-only. "Update recent visits" starts the update-info
// flow (procedures, then the location check) and comes back here when it's done.
(function () {
  const saved = requireSteps([]);
  if (!saved) return;

  const NOT_PROVIDED = 'Not provided';
  const historyEmployee = document.getElementById('history-employee');
  historyEmployee.value = readStep('demo_employee_id') || '';
  historyEmployee.addEventListener('change', function () {
    saveStep('demo_employee_id', historyEmployee.value || null);
    renderProcedures();
    renderBenefits();
  });

  renderAnswerRows(document.getElementById('about'), [
    ['Name', saved.name || NOT_PROVIDED],
    ['Email', saved.user],
    ['Company', saved.company ? labelFor(COMPANIES, saved.company) : NOT_PROVIDED],
    ['Location', saved.location ? formatLocation(saved.location) : NOT_PROVIDED],
    ['Dental office', saved.office ? officeLabel(saved.office) : NOT_PROVIDED],
  ]);

  document.getElementById('update').addEventListener('click', function () {
    window.location.href = startUpdate('manual', 'profile.html');
  });

  // The lists come from the backend (or this browser's stand-in for it), which
  // needs the sign-in from firebase.js. That's a module, so it has run by the
  // time the page has loaded.
  document.addEventListener('DOMContentLoaded', function () {
    renderAppointments();
    renderProcedures();
    renderBenefits();
    renderLocalHistory();
  });

  // "Thu, Oct 17, 2026 · 9:30 AM · Placeholder Smiles · Routine cleaning"
  function describeAppointment(appointment) {
    const start = new Date(appointment.starts_at);
    const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return [day, time, appointment.office_name, appointment.reason].filter(Boolean).join(' · ');
  }

  async function renderAppointments() {
    let result;
    try {
      result = await fetchAppointments();
    } catch (e) {
      return; // The rest of the page still works without them.
    }
    const now = Date.now();
    const dated = result.appointments.filter(function (a) { return !Number.isNaN(Date.parse(a.starts_at)); });
    const upcoming = dated.filter(function (a) { return Date.parse(a.starts_at) >= now; })
      .sort(function (a, b) { return Date.parse(a.starts_at) - Date.parse(b.starts_at); });
    const past = dated.filter(function (a) { return Date.parse(a.starts_at) < now; })
      .sort(function (a, b) { return Date.parse(b.starts_at) - Date.parse(a.starts_at); });

    fillList('upcoming', upcoming, describeAppointment);
    fillList('past', past, describeAppointment);
    document.getElementById('appointments-empty').hidden = dated.length > 0;
    document.getElementById('sample-note').hidden = !(result.sample && dated.length > 0);
  }

  async function renderProcedures() {
    const list = document.getElementById('procedures-list');
    const error = document.getElementById('procedures-error');
    list.replaceChildren();
    error.hidden = true;
    document.getElementById('procedures-empty').hidden = true;
    if (!historyEmployee.value) return;
    let procedures;
    try {
      procedures = await fetchProcedures(historyEmployee.value);
    } catch (e) {
      error.textContent = 'Could not load cloud care history. Please try again.';
      error.hidden = false;
      return;
    }
    // Newest first, by the month each was done.
    procedures.slice().sort(function (a, b) { return b.date.localeCompare(a.date); })
      .forEach(function (entry) { list.appendChild(summaryRow(describeProcedure(entry))); });
    document.getElementById('procedures-empty').hidden = procedures.length > 0;
  }

  async function renderBenefits() {
    const list = document.getElementById('plan');
    const note = document.getElementById('plan-note');
    list.replaceChildren();
    if (!historyEmployee.value) {
      note.textContent = 'Select a fictional employee to view connected demo benefits.';
      return;
    }
    try {
      const response = await apiFetch('/api/me/benefits?employee_id=' +
        encodeURIComponent(historyEmployee.value), 'GET');
      const benefits = response.benefits;
      renderAnswerRows(list, [
        ['Company', benefits.company_name],
        ['Plan', benefits.plan_name],
        ['Annual maximum', dollars(benefits.annual_maximum)],
        ['Used', dollars(benefits.used)],
        ['Remaining', dollars(benefits.remaining)],
      ]);
      note.textContent = 'Fictional demo plan and prices. Confirmed insurer payments are included.';
    } catch (e) {
      note.textContent = 'Could not load connected benefits. Please try again.';
    }
  }

  function renderLocalHistory() {
    const records = unverifiedLocalHistory();
    if (!records.length) return;
    const list = document.getElementById('local-history-list');
    records.forEach(function (entry) { list.appendChild(summaryRow(describeProcedure(entry))); });
    document.getElementById('local-history').hidden = false;
  }

  // Show the "<id>" section with a row per item, or leave it hidden when empty.
  function fillList(id, items, describe) {
    const list = document.getElementById(id + '-list');
    items.forEach(function (item) { list.appendChild(summaryRow(describe(item))); });
    document.getElementById(id).hidden = items.length === 0;
  }
})();
