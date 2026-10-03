// Review: show every answer, with a link back to the step that set it.
(function () {
  const saved = requireSteps(['location', 'office', 'category', 'procedure']);
  if (!saved) return;

  const category = categoryById(saved.category);
  if (!category) {
    window.location.replace('category.html');
    return;
  }

  // Only emergency work is allowed to arrive here without a timing answer.
  if (!saved.timing && !category.skipTiming) {
    window.location.replace('timing.html');
    return;
  }

  document.getElementById('progress').style.width = '100%';
  renderSummary('location-text', formatLocation(saved.location));
  renderSummary('office-text', officeLabel(saved.office));
  renderSummary('category-text', category.label);
  renderSummary('procedure-text', labelFor(category.procedures, saved.procedure));
  renderSummary('timing-text', labelFor(TIMEFRAMES, saved.timing || 'asap'));

  // Emergency timing isn't something the user picked, so don't offer to change it.
  if (category.skipTiming) {
    document.getElementById('emergency-note').hidden = false;
    document.getElementById('timing-change').hidden = true;
  }

  // Every answer was already sent as the user gave it (see api.js), so this just
  // moves on. For now it opens the temporary summary page.
  // TODO: replace with the real next screen once the Dialogflow flow exists.
  document.getElementById('submit').addEventListener('click', function () {
    window.location.href = 'summary.html';
  });

  // Start over with a clean slate rather than the previous answers.
  document.getElementById('start-over').addEventListener('click', clearAnswers);
})();
