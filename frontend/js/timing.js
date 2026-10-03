// Step 5: ask when the user needs the procedure done.
// Emergency work never reaches this page; it goes straight to the review.
(function () {
  const saved = requireSteps(['location', 'office', 'category', 'procedure']);
  if (!saved) return;

  const category = categoryById(saved.category);
  if (category && category.skipTiming) {
    window.location.replace('confirm.html');
    return;
  }

  renderStep('timing');
  renderSummary('location-text', formatLocation(saved.location));
  renderSummary('office-text', officeLabel(saved.office));
  renderSummary('procedure-text', labelFor(category.procedures, saved.procedure));

  const form = document.getElementById('timing-form');
  renderRadioCards(document.getElementById('timing-options'), 'timing', TIMEFRAMES);

  setupChoiceForm(form, document.getElementById('continue'), 'timing', saved.timing,
    function (id, button) {
      saveStep('timing', id);
      sendSteps(button, [{ step: 'timing', parameters: { timing: id } }], 'confirm.html');
    });
})();
