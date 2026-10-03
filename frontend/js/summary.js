// TEMPORARY page: lists every answer plus the raw values behind them.
// Delete alongside summary.html once the real post-submit screen exists.
(function () {
  const saved = requireSteps(['location', 'category', 'procedure']);
  if (!saved) return;

  const category = categoryById(saved.category);
  if (!category) {
    window.location.replace('category.html');
    return;
  }
  if (!saved.timing && !category.skipTiming) {
    window.location.replace('timing.html');
    return;
  }

  const timingId = saved.timing || 'asap';
  const state = STATES.find(function (s) { return s.code === saved.location.state; });

  const rows = [
    ['State', (state ? state.name : saved.location.state) + ' (' + saved.location.state + ')'],
    ['ZIP code', saved.location.zip || 'Not provided'],
    ['Care type', category.label],
    ['Procedure', labelFor(category.procedures, saved.procedure)],
    ['Timing', labelFor(TIMEFRAMES, timingId) +
      (category.skipTiming ? ' — set automatically for emergency care' : '')],
  ];

  const list = document.getElementById('answers');
  rows.forEach(function (row) {
    const wrapper = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = row[0];
    const value = document.createElement('dd');
    value.textContent = row[1];
    wrapper.append(term, value);
    list.appendChild(wrapper);
  });

  document.getElementById('payload').textContent = JSON.stringify({
    location: { state: saved.location.state, zip: saved.location.zip || null },
    category: category.id,
    procedure: saved.procedure,
    timing: timingId,
    timingAutoSet: Boolean(category.skipTiming),
  }, null, 2);

  document.getElementById('progress').style.width = '100%';
  document.getElementById('start-over').addEventListener('click', clearAnswers);
})();
