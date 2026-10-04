// Update info, step 1: the user must say whether they've had dental work, and
// add each procedure if they have. Saved with saveProcedures (api.js), where an
// empty list records that there was nothing new. Started by the 90-day sign-in
// check or by "Update info" in the header.
(function () {
  if (!requireSteps([])) return;
  // Opened directly rather than through "Update info": start an update here.
  if (!inUpdate()) startUpdate('manual', 'office.html');

  renderStep('procedures');

  const form = document.getElementById('procedures-form');
  const button = document.getElementById('continue');
  const addFieldset = document.getElementById('add-procedure');
  const addedList = document.getElementById('added-list');
  const select = document.getElementById('procedure');
  const fields = {
    procedure: { input: select, error: document.getElementById('procedure-error') },
    date: { input: document.getElementById('date'), error: document.getElementById('date-error') },
    cost: { input: document.getElementById('cost'), error: document.getElementById('cost-error') },
    you_paid: { input: document.getElementById('you-paid'), error: document.getElementById('you-paid-error') },
    insurance_paid: {
      input: document.getElementById('insurance-paid'),
      error: document.getElementById('insurance-paid-error'),
    },
  };
  const AMOUNTS = ['cost', 'you_paid', 'insurance_paid'];
  const now = new Date();
  const thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  // What has been answered so far on this visit, kept so going back or
  // reloading doesn't lose it: { hadWork: 'yes' | 'no' | null, entries: [] }.
  const draft = readStep('procedures_draft') || { hadWork: null, entries: [] };
  function saveDraft() { saveStep('procedures_draft', draft); }

  // The 90-day check says how long it's been; a manual update just asks.
  const stale = readStep('update_reason') === 'stale';
  document.getElementById('stale-note').hidden = !stale;
  const since = stale ? formatDay(readStep('previous_sign_in')) : '';
  document.getElementById('had-work-legend').textContent = since
    ? 'Have you had any dental work since ' + since + '?'
    : 'Have you had any dental work that isn\'t on file yet?';

  renderRadioCards(document.getElementById('had-work-options'), 'had_work', yesNoOptions(
    'Yes', 'I\'ll add each procedure',
    'No', 'Nothing new since then'));

  HISTORY_CATEGORIES.forEach(function (category) {
    const group = document.createElement('optgroup');
    group.label = category.label;
    category.procedures.forEach(function (p) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.label;
      group.appendChild(option);
    });
    select.appendChild(group);
  });
  fields.date.input.max = thisMonth;

  if (draft.hadWork) form.elements.had_work.value = draft.hadWork;
  renderAdded();
  update();

  // Ask for the earlier entries once firebase.js has loaded (it's a module, so
  // it runs after this script), since the live route needs the ID token.
  document.addEventListener('DOMContentLoaded', renderOnFile);

  form.addEventListener('change', function (event) {
    if (event.target.name !== 'had_work') return;
    draft.hadWork = event.target.value;
    saveDraft();
    update();
  });

  document.getElementById('add').addEventListener('click', function () {
    if (addEntry()) select.focus();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!draft.hadWork) return;
    if (draft.hadWork === 'yes') {
      // Count a procedure that was filled in but not added yet.
      if (hasTypedEntry() && !addEntry()) return;
      if (draft.entries.length === 0) {
        showSendError(button, 'Add at least one procedure, or choose No.');
        select.focus();
        return;
      }
    }
    const entries = draft.hadWork === 'yes' ? draft.entries : [];
    submitThenGo(button, async function () {
      await saveProcedures(entries);
      saveStep('procedures_saved', true);
      saveStep('procedures_draft', null);
    }, nextPage('procedures'));
  });

  // Show the add form only after "Yes", and allow Continue once there's an answer.
  function update() {
    addFieldset.hidden = draft.hadWork !== 'yes';
    addedList.hidden = draft.hadWork !== 'yes' || draft.entries.length === 0;
    button.disabled = !draft.hadWork;
  }

  function hasTypedEntry() {
    return Object.keys(fields).some(function (key) { return fields[key].input.value.trim() !== ''; });
  }

  // A dollar amount as a number, null when blank, or NaN when it isn't one.
  function parseAmount(text) {
    const cleaned = text.replace(/[$,\s]/g, '');
    if (cleaned === '') return null;
    return /^\d+(\.\d{1,2})?$/.test(cleaned) ? Number(cleaned) : NaN;
  }

  // Check the add form and, if it's fine, add the entry to the draft. Returns
  // whether it was added.
  function addEntry() {
    const procedure = select.value;
    const date = fields.date.input.value;
    const amounts = {};
    AMOUNTS.forEach(function (key) { amounts[key] = parseAmount(fields[key].input.value); });

    const messages = {
      procedure: procedure ? '' : 'Choose the procedure you had.',
      date: !date ? 'Enter the month it was done.'
        : date > thisMonth ? 'Choose a month that has already happened.' : '',
    };
    AMOUNTS.forEach(function (key) {
      messages[key] = Number.isNaN(amounts[key])
        ? 'Enter an amount like 120 or 120.50, or leave it blank.'
        : '';
    });
    const paid = (amounts.you_paid || 0) + (amounts.insurance_paid || 0);
    if (!messages.cost && amounts.cost !== null && !Number.isNaN(paid) && paid > amounts.cost) {
      messages.cost = 'What you and insurance paid adds up to more than the total cost.';
    }

    Object.keys(fields).forEach(function (key) {
      setFieldError(fields[key].input, fields[key].error, messages[key]);
    });
    const firstBad = Object.keys(fields).find(function (key) { return messages[key]; });
    if (firstBad) { fields[firstBad].input.focus(); return false; }

    const category = HISTORY_CATEGORIES.find(function (c) {
      return c.procedures.some(function (p) { return p.id === procedure; });
    });
    draft.entries.push(Object.assign({ procedure: procedure, category: category.id, date: date }, amounts));
    saveDraft();
    Object.keys(fields).forEach(function (key) { fields[key].input.value = ''; });
    showSendError(button, '');
    renderAdded();
    update();
    return true;
  }

  function renderAdded() {
    addedList.replaceChildren();
    draft.entries.forEach(function (entry, i) {
      const row = summaryRow(describeEntry(entry));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'link-btn';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove ' + procedureLabel(entry.procedure));
      remove.addEventListener('click', function () {
        draft.entries.splice(i, 1);
        saveDraft();
        renderAdded();
        update();
      });
      row.appendChild(remove);
      addedList.appendChild(row);
    });
  }

  async function renderOnFile() {
    let recorded;
    try {
      recorded = await fetchProcedures();
    } catch (e) {
      return; // Nice to have; the page works without it.
    }
    if (recorded.length === 0) return;
    const list = document.getElementById('on-file-list');
    recorded.forEach(function (entry) { list.appendChild(summaryRow(describeEntry(entry))); });
    document.getElementById('on-file').hidden = false;
  }

  // A .summary row with one line of text.
  function summaryRow(text) {
    const row = document.createElement('p');
    row.className = 'summary';
    const span = document.createElement('span');
    span.textContent = text;
    row.appendChild(span);
    return row;
  }

  function procedureLabel(id) {
    for (const category of HISTORY_CATEGORIES) {
      const match = category.procedures.find(function (p) { return p.id === id; });
      if (match) return match.label;
    }
    return id;
  }

  // "Filling · Aug 2026 · $200.00 total, you paid $40.00"
  function describeEntry(entry) {
    const [year, month] = entry.date.split('-').map(Number);
    const when = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const money = [];
    if (entry.cost !== null && entry.cost !== undefined) money.push(dollars(entry.cost) + ' total');
    if (entry.you_paid !== null && entry.you_paid !== undefined) money.push('you paid ' + dollars(entry.you_paid));
    if (entry.insurance_paid !== null && entry.insurance_paid !== undefined) {
      money.push('insurance paid ' + dollars(entry.insurance_paid));
    }
    return [procedureLabel(entry.procedure), when].concat(money.length ? [money.join(', ')] : []).join(' · ');
  }

  function dollars(value) {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  // "June 5, 2026" from an ISO time, or '' when there isn't one.
  function formatDay(iso) {
    const time = Date.parse(iso || '');
    if (Number.isNaN(time)) return '';
    return new Date(time).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
})();
