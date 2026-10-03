// Step 1: collect the user's location, save it for step 2, then move on.
(function () {
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

  function setError(input, message, show) {
    message.hidden = !show;
    input.setAttribute('aria-invalid', show ? 'true' : 'false');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    const state = stateSelect.value;
    const zip = zipInput.value.trim();
    const stateOk = state !== '';
    const zipOk = zip === '' || /^\d{5}$/.test(zip);

    setError(stateSelect, stateError, !stateOk);
    setError(zipInput, zipError, !zipOk);
    if (!stateOk) { stateSelect.focus(); return; }
    if (!zipOk) { zipInput.focus(); return; }

    saveStep('location', { state: state, zip: zip });
    window.location.href = 'procedure.html';
  });
})();
