// Helpers shared by the step pages. Loaded after options.js.

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
