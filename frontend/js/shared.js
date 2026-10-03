// Helpers shared by the step pages. Loaded after options.js.

// The steps in order, and the page that collects each one.
const FLOW = [
  { key: 'location', page: 'index.html' },
  { key: 'office', page: 'office.html' },
  { key: 'category', page: 'category.html' },
  { key: 'procedure', page: 'procedure.html' },
  { key: 'timing', page: 'timing.html' },
];

// Read a saved step. Returns null if nothing is saved or storage is unavailable.
function readStep(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key));
  } catch (e) {
    return null;
  }
}

function saveStep(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* ignore: the next page sends the user back if nothing was saved */ }
}

function clearAnswers() {
  try {
    sessionStorage.clear();
  } catch (e) { /* ignore */ }
}

function answeredSteps() {
  const location = readStep('location');
  return {
    location: location && location.state ? location : null,
    office: readStep('office'),
    category: readStep('category'),
    procedure: readStep('procedure'),
    timing: readStep('timing'),
  };
}

// Send the user back to the first of `keys` they haven't answered yet.
// Returns the saved answers, or null when the page is redirecting away.
function requireSteps(keys) {
  const saved = answeredSteps();
  for (let i = 0; i < FLOW.length; i++) {
    const step = FLOW[i];
    if (keys.indexOf(step.key) !== -1 && !saved[step.key]) {
      window.location.replace(step.page);
      return null;
    }
  }
  return saved;
}

function categoryById(id) {
  return CATEGORIES.find(function (c) { return c.id === id; }) || null;
}

function stateName(code) {
  const match = STATES.find(function (s) { return s.code === code; });
  return match ? match.name : code;
}

// "Texas 78701" from a saved location.
function formatLocation(location) {
  const name = stateName(location.state);
  return location.zip ? name + ' ' + location.zip : name;
}

// State codes whose ZIP prefixes include this ZIP. Empty when no state claims it.
function statesForZip(zip) {
  const prefix = Number(zip.slice(0, 3));
  return Object.keys(ZIP_PREFIXES).filter(function (code) {
    return ZIP_PREFIXES[code].some(function (range) {
      return prefix >= range[0] && prefix <= range[1];
    });
  });
}

// False only when the ZIP clearly belongs to other states. Unclaimed prefixes
// pass, since we can't say they're wrong. This checks consistency with the
// state, not that the ZIP exists.
function zipFitsState(zip, stateCode) {
  const owners = statesForZip(zip);
  return owners.length === 0 || owners.indexOf(stateCode) !== -1;
}

function labelFor(items, id) {
  const match = items.find(function (item) { return item.id === id; });
  return match ? match.label : id;
}

// The offices the backend returned for the user's location (see api.js).
function savedOffices() {
  return readStep('offices') || [];
}

// The chosen office's name, falling back to its id if the list is gone.
function officeLabel(id) {
  const match = savedOffices().find(function (o) { return o.id === id; });
  return match ? match.name : id;
}

// Emergency work skips the timing step, so the flow is one step shorter.
function totalSteps() {
  const category = categoryById(readStep('category'));
  return category && category.skipTiming ? 4 : 5;
}

// Fill in the "Step 2 of 4" label and the progress bar at the top of the card.
function renderStep(current) {
  const total = totalSteps();
  const label = document.getElementById('step-label');
  const fill = document.getElementById('progress');
  if (label) label.textContent = 'Step ' + current + ' of ' + total;
  if (fill) fill.style.width = Math.round((current / total) * 100) + '%';
}

// Fill a summary row, hiding the whole row when there is nothing to show.
function renderSummary(id, text) {
  const target = document.getElementById(id);
  if (!target) return;
  if (text) {
    target.textContent = text;
  } else {
    const row = target.closest('.summary');
    if (row) row.hidden = true;
  }
}

// Build one keyboard-accessible radio card per item.
function renderRadioCards(container, name, items) {
  items.forEach(function (item) {
    const label = document.createElement('label');
    label.className = 'option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = item.id;

    const body = document.createElement('span');
    body.className = 'option-body';

    const title = document.createElement('span');
    title.className = 'option-title';
    title.textContent = item.label;

    const desc = document.createElement('span');
    desc.className = 'option-desc';
    desc.textContent = item.description;

    body.append(title, desc);
    label.append(input, body);
    container.appendChild(label);
  });
}

// Wire a radio-card form: preselect any saved answer, keep the button in step,
// and hand the chosen id and the button to onSubmit.
function setupChoiceForm(form, button, name, savedId, onSubmit) {
  if (savedId) form.elements[name].value = savedId;
  button.disabled = !form.elements[name].value;

  form.addEventListener('change', function () {
    button.disabled = !form.elements[name].value;
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const id = form.elements[name].value;
    if (id) onSubmit(id, button);
  });
}
