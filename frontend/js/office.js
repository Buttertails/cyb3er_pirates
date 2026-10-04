// Step 2: pick a dentist office from the list the backend returned for step 1.
// Sign-up and the update-info questions ask this too (ONBOARDING and UPDATE in
// shared.js), with the same suggestions: there the choice is the office the user
// goes to, saved to their profile. It's the last update question.
(function () {
  const saved = requireSteps(['location']);
  if (!saved) return;

  const savesToProfile = inOnboarding() || inUpdate();
  renderStep('office');
  if (savesToProfile) document.getElementById('heading').textContent = 'Which dental office do you go to?';
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
      const last = isLastStep('office');
      submitThenGo(button, async function () {
        if (savesToProfile) await saveProfileDetails({ office: id });
        await sendStep('office', { office: id });
        if (last) await finishFlow();
      }, nextPage('office'));
    });
})();
