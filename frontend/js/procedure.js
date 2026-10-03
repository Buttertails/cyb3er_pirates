// Step 2: show the saved location, let the user pick a dental procedure.
(function () {
  const location = readStep('location');

  // No location yet (e.g. page opened directly): go back to step 1.
  if (!location || !location.state) {
    window.location.replace('index.html');
    return;
  }

  document.getElementById('location-text').textContent = formatLocation(location);

  const form = document.getElementById('procedure-form');
  renderRadioCards(document.getElementById('procedure-options'), 'procedure', PROCEDURES);

  setupChoiceForm(form, document.getElementById('continue'), 'procedure', readStep('procedure'),
    function (id) {
      saveStep('procedure', id);
      window.location.href = 'timing.html';
    });
})();
