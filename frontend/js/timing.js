// Step 4: ask when the user needs the procedure done.
// Emergency work never reaches this page; it goes straight to the review.
(function () {
  const saved = requireSteps(['location', 'category', 'procedure']);
  if (!saved) return;

  const category = categoryById(saved.category);
  if (category && category.skipTiming) {
    window.location.replace('confirm.html');
    return;
  }

  renderStep(4);
  renderSummary('location-text', formatLocation(saved.location));
  renderSummary('procedure-text', labelFor(category.procedures, saved.procedure));

  const form = document.getElementById('timing-form');
  renderRadioCards(document.getElementById('timing-options'), 'timing', TIMEFRAMES);

  setupChoiceForm(form, document.getElementById('continue'), 'timing', saved.timing,
    function (id) {
      saveStep('timing', id);
      window.location.href = 'confirm.html';
    });
})();
