// Step 1: collect the user's location, save it, then move on to choose an office.
// Asked once: sign-in skips this page when the backend already has a location.
// The "Change" link on the review page still comes back here to update it.
(function () {
  // Nothing before this step is required except being signed in.
  if (!requireSteps([])) return;

  renderStep(1);

  const form = document.getElementById('location-form');
  const stateSelect = document.getElementById('state');
  const zipInput = document.getElementById('zip');
  const stateError = document.getElementById('state-error');
  const zipError = document.getElementById('zip-error');

  STATES.forEach(function (s) {
    const option = document.createElement('option');
    option.value = s.code;
    option.textContent = s.name;
    stateSelect.appendChild(option);
  });

  // Prefill if the user came back via "Change" on a later step.
  const saved = readStep('location');
  if (saved) {
    stateSelect.value = saved.state || '';
    zipInput.value = saved.zip || '';
  }

  // An empty message hides the error.
  function setError(input, errorElement, message) {
    errorElement.textContent = message;
    errorElement.hidden = !message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  // What's wrong with the ZIP, or '' if it's fine. Checked in order: format, then state match.
  function zipProblem(zip, state) {
    if (zip === '') return '';
    if (!/^\d{5}$/.test(zip)) return 'Enter a 5-digit ZIP code, or leave it blank.';
    if (state && !zipFitsState(zip, state)) {
      const actual = statesForZip(zip).map(stateName).join(' or ');
      return 'ZIP code ' + zip + ' is in ' + actual + ', not ' + stateName(state) +
        '. Check your state and ZIP code.';
    }
    return '';
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    const state = stateSelect.value;
    const zip = zipInput.value.trim();
    const stateMessage = state === '' ? 'Please select a state.' : '';
    const zipMessage = zipProblem(zip, state);

    setError(stateSelect, stateError, stateMessage);
    setError(zipInput, zipError, zipMessage);
    if (stateMessage) { stateSelect.focus(); return; }
    // Reprompt on the ZIP field: it's the one that can be re-entered fastest.
    if (zipMessage) { zipInput.focus(); return; }

    saveStep('location', { state: state, zip: zip });
    // Save it to the user's profile so later sign-ins skip this step, then send
    // it as the intake message that returns the offices. A blank ZIP is sent as
    // null so a ZIP sent earlier gets cleared on the other end.
    submitThenGo(form.querySelector('button[type="submit"]'), async function () {
      await saveProfileLocation(state, zip || null);
      await sendStep('location', { state: state, zip: zip || null });
    }, 'office.html');
  });
})();
