// Helpers shared by the step pages. Loaded after options.js.

// The steps in order, and the page that collects each one.
const FLOW = [
  { key: 'location', page: 'index.html' },
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

// "Texas 78701" from a saved location.
function formatLocation(location) {
  const match = STATES.find(function (s) { return s.code === location.state; });
  const name = match ? match.name : location.state;
  return location.zip ? name + ' ' + location.zip : name;
}

function labelFor(items, id) {
  const match = items.find(function (item) { return item.id === id; });
  return match ? match.label : id;
}

// Emergency work skips the timing step, so the flow is one step shorter.
function totalSteps() {
  const category = categoryById(readStep('category'));
  return category && category.skipTiming ? 3 : 4;
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
// and hand the chosen id to onSubmit.
function setupChoiceForm(form, button, name, savedId, onSubmit) {
  if (savedId) form.elements[name].value = savedId;
  button.disabled = !form.elements[name].value;

  form.addEventListener('change', function () {
    button.disabled = !form.elements[name].value;
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const id = form.elements[name].value;
    if (id) onSubmit(id);
  });
}
