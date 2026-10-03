// Step 3: pick one of the three care categories.
(function () {
  const saved = requireSteps(['location', 'office']);
  if (!saved) return;

  renderStep('category');
  renderSummary('location-text', formatLocation(saved.location));
  renderSummary('office-text', officeLabel(saved.office));

  const form = document.getElementById('category-form');
  renderRadioCards(document.getElementById('category-options'), 'category', CATEGORIES);

  setupChoiceForm(form, document.getElementById('continue'), 'category', saved.category,
    function (id, button) {
      if (id !== saved.category) {
        // A procedure picked under the old category no longer applies.
        saveStep('procedure', null);
        // Emergency sets the timing to ASAP on the user's behalf. Drop that when
        // they switch away, so the timing step doesn't come up pre-answered.
        const previous = categoryById(saved.category);
        if (previous && previous.skipTiming) saveStep('timing', null);
      }
      saveStep('category', id);
      sendSteps(button, [{ step: 'category', parameters: { category: id } }], 'procedure.html');
    });
})();
