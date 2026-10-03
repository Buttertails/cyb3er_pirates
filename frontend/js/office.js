// Step 2: pick a dentist office from the list the backend returned for step 1.
(function () {
  const saved = requireSteps(['location']);
  if (!saved) return;

  renderStep(2);
  renderSummary('location-text', formatLocation(saved.location));

  const form = document.getElementById('office-form');
  const offices = savedOffices();

  // Nothing to choose from: say so instead of showing an empty list.
  if (offices.length === 0) {
    form.hidden = true;
    document.getElementById('no-offices').hidden = false;
    return;
  }

  renderRadioCards(document.getElementById('office-options'), 'office', offices.map(function (o) {
    const parts = [o.address];
    if (typeof o.distance_miles === 'number') parts.push(o.distance_miles + ' mi away');
    return { id: o.id, label: o.name, description: parts.filter(Boolean).join(' · ') };
  }));

  setupChoiceForm(form, document.getElementById('continue'), 'office', saved.office,
    function (id, button) {
      saveStep('office', id);
      sendSteps(button, [{ step: 'office', parameters: { office: id } }], 'category.html');
    });
})();
