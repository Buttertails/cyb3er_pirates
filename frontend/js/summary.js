// TEMPORARY page: lists every answer plus the messages that were sent for them.
// Delete alongside summary.html once the real post-submit screen exists.
(function () {
  const saved = requireSteps(['location', 'office', 'category', 'procedure']);
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
    ['Office', officeLabel(saved.office) + ' (' + saved.office + ')'],
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

  // The messages are logged by api.js as each step is sent, in order.
  const sent = readStep('sent_log') || [];
  const modeNote = document.getElementById('sent-mode');
  if (sent.length === 0) {
    modeNote.textContent = 'No messages were recorded for this session.';
  } else if (sent[0].mode === 'browser_intake') {
    modeNote.textContent = 'Wizard selections stay in this browser session. Profile saves and estimates use the cloud service.';
  } else {
    modeNote.textContent = 'Each message was sent to the backend in this order.';
  }

  const sentList = document.getElementById('sent-list');
  sent.forEach(function (entry) {
    const item = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = entry.request.event.name;
    const body = document.createElement('pre');
    body.textContent = JSON.stringify(entry.request, null, 2);
    item.append(name, body);
    sentList.appendChild(item);
  });

  document.getElementById('progress').style.width = '100%';
  document.getElementById('start-over').addEventListener('click', clearAnswers);
})();
