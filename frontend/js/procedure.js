// Step 4: pick a procedure from within the chosen category.
(function () {
  const saved = requireSteps(['location', 'office', 'category']);
  if (!saved) return;

  const category = categoryById(saved.category);
  if (!category) {
    window.location.replace('category.html');
    return;
  }

  renderStep('procedure');
  document.getElementById('heading').textContent = category.prompt;
  renderSummary('location-text', formatLocation(saved.location));
  renderSummary('office-text', officeLabel(saved.office));
  renderSummary('category-text', category.label);

  const form = document.getElementById('procedure-form');
  renderRadioCards(document.getElementById('procedure-options'), 'procedure', category.procedures);

  // Only preselect a saved procedure that belongs to this category.
  const inCategory = category.procedures.some(function (p) { return p.id === saved.procedure; });

  setupChoiceForm(form, document.getElementById('continue'), 'procedure',
    inCategory ? saved.procedure : null,
    function (id, button) {
      saveStep('procedure', id);
      const pieces = [{ step: 'procedure', parameters: { procedure: id } }];

      // Emergency work is ASAP by definition, so skip the timing question. The
      // timing is still sent so the flow gets every answer, flagged as auto-set.
      if (category.skipTiming) {
        saveStep('timing', 'asap');
        pieces.push({ step: 'timing', parameters: { timing: 'asap' }, autoSet: true });
        sendSteps(button, pieces, 'confirm.html');
      } else {
        sendSteps(button, pieces, 'timing.html');
      }
    });
})();
