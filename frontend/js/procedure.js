// Step 3: pick a procedure from within the chosen category.
(function () {
  const saved = requireSteps(['location', 'category']);
  if (!saved) return;

  const category = categoryById(saved.category);
  if (!category) {
    window.location.replace('category.html');
    return;
  }

  renderStep(3);
  document.getElementById('heading').textContent = category.prompt;
  renderSummary('location-text', formatLocation(saved.location));
  renderSummary('category-text', category.label);

  const form = document.getElementById('procedure-form');
  renderRadioCards(document.getElementById('procedure-options'), 'procedure', category.procedures);

  // Only preselect a saved procedure that belongs to this category.
  const inCategory = category.procedures.some(function (p) { return p.id === saved.procedure; });

  setupChoiceForm(form, document.getElementById('continue'), 'procedure',
    inCategory ? saved.procedure : null,
    function (id) {
      saveStep('procedure', id);

      // Emergency work is ASAP by definition, so skip the timing question.
      if (category.skipTiming) {
        saveStep('timing', 'asap');
        window.location.href = 'confirm.html';
      } else {
        window.location.href = 'timing.html';
      }
    });
})();
