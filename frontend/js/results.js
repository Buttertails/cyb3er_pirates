// Results: show the engine's coverage estimate for the selected procedure.
// Guards the flow like the other step pages, then calls requestEstimate (api.js)
// and renders the cost split, line-item breakdown, and plain-language notes.
(function () {
  const saved = requireSteps(['location', 'office', 'category', 'procedure']);
  if (!saved) return;

  const category = categoryById(saved.category);
  if (!category) {
    window.location.replace('category.html');
    return;
  }
  // Only emergency work may arrive without a timing answer.
  if (!saved.timing && !category.skipTiming) {
    window.location.replace('timing.html');
    return;
  }

  document.getElementById('progress').style.width = '100%';

  // Carry-forward summary.
  renderSummary('procedure-text', labelFor(category.procedures, saved.procedure));
  renderSummary('timing-text', labelFor(TIMEFRAMES, saved.timing || 'asap'));
  if (category.skipTiming) {
    document.getElementById('timing-change').hidden = true;
  }

  const loading = document.getElementById('loading');
  const errorBox = document.getElementById('error');
  const errorText = document.getElementById('error-text');
  const result = document.getElementById('result');

  function money(value) {
    const number = Number(value) || 0;
    return number.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function showOnly(section) {
    loading.hidden = section !== 'loading';
    errorBox.hidden = section !== 'error';
    result.hidden = section !== 'result';
  }

  function showError(message) {
    errorText.textContent = message ||
      "We couldn't calculate your estimate just now.";
    showOnly('error');
  }

  function renderBreakdown(line, estimate) {
    const rows = [
      ['Procedure cost', money(line.allowed_amount)],
      ['Coverage', line.covered
        ? Math.round((line.coverage_rate || 0) * 100) + '% of allowed cost'
        : 'Not covered by this plan'],
    ];
    if (line.deductible_applied) {
      rows.push(['Deductible applied', money(line.deductible_applied)]);
    }
    if (typeof estimate.annual_max_remaining_after === 'number') {
      rows.push(['Annual maximum left after this',
        money(estimate.annual_max_remaining_after)]);
    }

    const list = document.getElementById('breakdown');
    list.textContent = '';
    rows.forEach(function (row) {
      const wrapper = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = row[0];
      const value = document.createElement('dd');
      value.textContent = row[1];
      wrapper.append(term, value);
      list.appendChild(wrapper);
    });
  }

  function renderReasons(line) {
    const reasons = Array.isArray(line.reasons) ? line.reasons : [];
    const list = document.getElementById('reasons');
    list.textContent = '';
    if (reasons.length === 0) {
      list.hidden = true;
      return;
    }
    reasons.forEach(function (text) {
      const item = document.createElement('li');
      item.textContent = text;
      list.appendChild(item);
    });
    list.hidden = false;
  }

  function render(estimate) {
    const line = (estimate.lines && estimate.lines[0]) || null;
    if (!line) {
      showError('No estimate was returned for this procedure.');
      return;
    }

    const totals = estimate.totals || {};
    document.getElementById('cost-total').textContent =
      money(line.allowed_amount);
    document.getElementById('cost-plan').textContent =
      money(totals.plan_pays != null ? totals.plan_pays : line.plan_pays);
    document.getElementById('cost-you').textContent =
      money(totals.employee_owes != null ? totals.employee_owes : line.employee_owes);

    renderBreakdown(line, estimate);
    renderReasons(line);

    const flag = document.getElementById('estimate-flag');
    if (estimate._local_demo) {
      flag.textContent = 'Local demo estimate — approximate figures, nothing left your browser.';
      flag.hidden = false;
    } else {
      flag.hidden = true;
    }

    showOnly('result');
  }

  function loadEstimate() {
    showOnly('loading');
    requestEstimate(saved.procedure, {})
      .then(render)
      .catch(function (e) {
        if (e && e.message === 'unmapped-procedure') {
          showError("We can't estimate that selection yet. Try a different procedure.");
        } else {
          showError();
        }
      });
  }

  document.getElementById('retry').addEventListener('click', loadEstimate);
  document.getElementById('start-over').addEventListener('click', clearAnswers);

  loadEstimate();
})();
