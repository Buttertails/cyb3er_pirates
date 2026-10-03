// Review: show every answer, with a link back to the step that set it.
(function () {
  const saved = requireSteps(['location', 'category', 'procedure']);
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
  renderSummary('category-text', category.label);
  renderSummary('procedure-text', labelFor(category.procedures, saved.procedure));
  renderSummary('timing-text', labelFor(TIMEFRAMES, saved.timing || 'asap'));

  // Emergency timing isn't something the user picked, so don't offer to change it.
  if (category.skipTiming) {
    document.getElementById('emergency-note').hidden = false;
    document.getElementById('timing-change').hidden = true;
  }

  document.getElementById('submit').addEventListener('click', function (event) {
    event.target.hidden = true;
    document.getElementById('submitted').hidden = false;
  });

  // Start over with a clean slate rather than the previous answers.
  document.getElementById('start-over').addEventListener('click', clearAnswers);
})();
