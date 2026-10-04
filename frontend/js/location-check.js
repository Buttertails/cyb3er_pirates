// Update info, step 2: is the user still at the location we have for them? Yes
// finishes the update. No goes on to location.html and office.html, which
// follow the UPDATE steps while the update is under way (see shared.js).
(function () {
  if (!inUpdate()) {
    window.location.replace(UPDATE[0].page);
    return;
  }
  const saved = requireAnswered([FLOW[0], UPDATE[0]]);
  if (!saved) return;

  // Nothing to confirm: ask for the location straight away.
  if (!saved.location) {
    saveStep('still_here', 'no');
    window.location.replace(nextPage('location-check'));
    return;
  }

  renderStep('location-check');
  document.getElementById('heading').textContent =
    'Are you still in ' + formatLocation(saved.location) + '?';
  renderSummary('office-text', saved.office ? officeLabel(saved.office) : '');
  const group = document.getElementById('summary-group');
  group.hidden = !group.querySelector('.summary:not([hidden])');

  renderRadioCards(document.getElementById('location-check-options'), 'still_here', yesNoOptions(
    'Yes, I\'m still here', 'Keep my location and dental office',
    'No, I\'ve moved', 'Enter where you are now'));

  setupChoiceForm(document.getElementById('location-check-form'), document.getElementById('continue'),
    'still_here', saved['location-check'], function (answer, button) {
      // Saved first: it decides whether location and office are still to come.
      saveStep('still_here', answer);
      const next = nextPage('location-check');
      if (answer === 'no') {
        window.location.href = next;
        return;
      }
      submitThenGo(button, finishFlow, next);
    });
})();
