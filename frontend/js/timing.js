// Step 3: ask when the user needs the procedure done.
(function () {
  const location = readStep('location');
  const procedure = readStep('procedure');

  // Send the user back to whichever step is still unanswered.
  if (!location || !location.state) {
    window.location.replace('index.html');
    return;
  }
  if (!procedure) {
    window.location.replace('procedure.html');
    return;
  }

  const locationText = formatLocation(location);
  const procedureText = labelFor(PROCEDURES, procedure);
  document.getElementById('location-text').textContent = locationText;
  document.getElementById('procedure-text').textContent = procedureText;

  const form = document.getElementById('timing-form');
  renderRadioCards(document.getElementById('timing-options'), 'timing', TIMEFRAMES);

  setupChoiceForm(form, document.getElementById('continue'), 'timing', readStep('timing'),
    function (id) {
      saveStep('timing', id);

      // TODO: replace this placeholder with the next step or a backend call.
      document.getElementById('confirmation-text').textContent =
        procedureText + ' in ' + locationText + ', needed ' + labelFor(TIMEFRAMES, id).toLowerCase() + '.';
      form.hidden = true;
      document.getElementById('confirmation').hidden = false;
    });

  // Start over with a clean slate rather than the previous answers.
  document.getElementById('start-over').addEventListener('click', function () {
    try {
      sessionStorage.clear();
    } catch (e) { /* ignore: the link still navigates to step 1 */ }
  });
})();
