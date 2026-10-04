import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { STATES, TIMEFRAMES } from '../../js/options.js';
import {
  AnswerList,
  Card,
  IntakeSummary,
  Progress,
  useDocumentTitle,
  useFlowGuard,
} from '../components.jsx';
import { requestEstimate } from '../lib/api.js';
import {
  categoryById,
  clearAnswers,
  labelFor,
  officeLabel,
  readStep,
  ROUTES,
} from '../lib/storage.js';

export function ConfirmPage() {
  useDocumentTitle('Review');
  const { saved, blocked } = useFlowGuard(['location', 'office', 'category', 'procedure']);
  const navigate = useNavigate();
  const category = categoryById(saved.category);

  useEffect(() => {
    if (blocked) return;
    if (!category) navigate(ROUTES.category, { replace: true });
    else if (!saved.timing && !category.skipTiming) navigate(ROUTES.timing, { replace: true });
  }, [blocked, category, navigate, saved.timing]);

  if (blocked || !category || (!saved.timing && !category.skipTiming)) return null;
  return (
    <Card>
      <Progress complete />
      <p className="step">Review</p>
      <h1>Here's what you told us</h1>
      {category.skipTiming && (
        <p className="note">This is emergency care, so we've marked it as needed right away.</p>
      )}
      <IntakeSummary saved={saved} rows={[
        { key: 'location', label: 'Location', to: ROUTES.location },
        { key: 'office', label: 'Office', to: ROUTES.office },
        { key: 'category', label: 'Care type', value: category.label, to: ROUTES.category },
        {
          key: 'procedure', label: 'Procedure',
          value: labelFor(category.procedures, saved.procedure), to: ROUTES.procedure,
        },
        {
          key: 'timing', label: 'Timing',
          value: labelFor(TIMEFRAMES, saved.timing || 'asap'),
          to: category.skipTiming ? null : ROUTES.timing,
        },
      ]} />
      <button type="button" className="btn" onClick={() => navigate(ROUTES.results)}>Submit request</button>
      <p className="actions">
        <Link className="link" to={ROUTES.location} onClick={clearAnswers}>Start over</Link>
      </p>
    </Card>
  );
}

function money(value) {
  return (Number(value) || 0).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export function ResultsPage() {
  useDocumentTitle('Your estimate');
  const { saved, blocked } = useFlowGuard(['location', 'office', 'category', 'procedure']);
  const navigate = useNavigate();
  const category = categoryById(saved.category);
  const [status, setStatus] = useState('loading');
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (blocked) return;
    if (!category) navigate(ROUTES.category, { replace: true });
    else if (!saved.timing && !category.skipTiming) navigate(ROUTES.timing, { replace: true });
  }, [blocked, category, navigate, saved.timing]);

  async function loadEstimate() {
    setStatus('loading');
    setError('');
    try {
      const nextEstimate = await requestEstimate(saved.procedure);
      if (!nextEstimate.lines?.[0]) throw new Error('empty-estimate');
      setEstimate(nextEstimate);
      setStatus('result');
    } catch (cause) {
      setError(cause?.message === 'unmapped-procedure'
        ? "We can't estimate that selection yet. Try a different procedure."
        : "We couldn't calculate your estimate just now.");
      setStatus('error');
    }
  }

  useEffect(() => {
    if (!blocked && category && (saved.timing || category.skipTiming)) loadEstimate();
  }, [blocked, category, saved.procedure, saved.timing]);

  if (blocked || !category || (!saved.timing && !category.skipTiming)) return null;
  const line = estimate?.lines?.[0];
  const totals = estimate?.totals || {};
  const breakdown = line ? [
    ['Procedure cost', money(line.allowed_amount)],
    ['Coverage', line.covered
      ? `${Math.round((line.coverage_rate || 0) * 100)}% of allowed cost`
      : 'Not covered by this plan'],
    ...(line.deductible_applied ? [['Deductible applied', money(line.deductible_applied)]] : []),
    ...(typeof estimate.annual_max_remaining_after === 'number'
      ? [['Annual maximum left after this', money(estimate.annual_max_remaining_after)]] : []),
  ] : [];

  return (
    <Card>
      <Progress complete />
      <p className="step">Your estimate</p>
      <h1>Here's what to expect</h1>
      <p className="lead">Based on your plan and the care you selected.</p>
      <IntakeSummary saved={saved} rows={[
        {
          key: 'procedure', label: 'Procedure',
          value: labelFor(category.procedures, saved.procedure), to: ROUTES.procedure,
        },
        {
          key: 'timing', label: 'Timing',
          value: labelFor(TIMEFRAMES, saved.timing || 'asap'),
          to: category.skipTiming ? null : ROUTES.timing,
        },
      ]} />

      {status === 'loading' && <p className="note" role="status">Calculating your estimate…</p>}
      {status === 'error' && (
        <div>
          <p className="note note-error" role="alert">{error}</p>
          <button type="button" className="btn" onClick={loadEstimate}>Try again</button>
        </div>
      )}
      {status === 'result' && line && (
        <div>
          {estimate._local_demo && (
            <p className="estimate-flag">Local demo estimate — approximate figures, nothing left your browser.</p>
          )}
          <div className="cost-grid">
            <div className="cost-cell">
              <span className="cost-label">Procedure cost</span>
              <span className="cost-value">{money(line.allowed_amount)}</span>
            </div>
            <div className="cost-cell cost-cell-plan">
              <span className="cost-label">Your plan pays</span>
              <span className="cost-value">{money(totals.plan_pays ?? line.plan_pays)}</span>
            </div>
            <div className="cost-cell cost-cell-you">
              <span className="cost-label">You pay</span>
              <span className="cost-value">{money(totals.employee_owes ?? line.employee_owes)}</span>
            </div>
          </div>
          <AnswerList rows={breakdown} />
          {line.reasons?.length > 0 && (
            <ul className="reasons">{line.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          )}
          <p className="disclaimer">
            This is an approximate estimate using fictional plan data, not a claims decision or clinical advice.
          </p>
        </div>
      )}

      <p className="actions">
        <Link className="link" to={ROUTES.confirm}>Back to review</Link>
        <Link className="link" to={ROUTES.location} onClick={clearAnswers}>Start over</Link>
      </p>
    </Card>
  );
}

export function SummaryPage() {
  useDocumentTitle('Temporary summary');
  const { saved, blocked } = useFlowGuard(['location', 'office', 'category', 'procedure']);
  const navigate = useNavigate();
  const category = categoryById(saved.category);

  useEffect(() => {
    if (blocked) return;
    if (!category) navigate(ROUTES.category, { replace: true });
    else if (!saved.timing && !category.skipTiming) navigate(ROUTES.timing, { replace: true });
  }, [blocked, category, navigate, saved.timing]);

  if (blocked || !category || (!saved.timing && !category.skipTiming)) return null;
  const state = STATES.find((item) => item.code === saved.location.state);
  const timing = saved.timing || 'asap';
  const sent = readStep('sent_log') || [];
  const mode = sent.length === 0
    ? 'No messages were recorded for this session.'
    : sent[0].mode === 'local_demo'
      ? 'Local demo: nothing left this browser. Each message was logged and acknowledged locally.'
      : 'Each message was sent to the backend in this order.';
  return (
    <Card>
      <Progress complete />
      <p className="temp-banner"><strong>Temporary page.</strong> Scaffolding for team review.</p>
      <p className="step">Summary</p>
      <h1>Everything you selected</h1>
      <AnswerList rows={[
        ['State', `${state?.name || saved.location.state} (${saved.location.state})`],
        ['ZIP code', saved.location.zip || 'Not provided'],
        ['Office', `${officeLabel(saved.office)} (${saved.office})`],
        ['Care type', category.label],
        ['Procedure', labelFor(category.procedures, saved.procedure)],
        ['Timing', `${labelFor(TIMEFRAMES, timing)}${category.skipTiming ? ' — set automatically for emergency care' : ''}`],
      ]} />
      <h2 className="subhead">Messages sent</h2>
      <p className="lead">{mode}</p>
      <ol className="sent-list">
        {sent.map((entry, index) => (
          <li key={`${entry.request.event.name}-${index}`}>
            <strong>{entry.request.event.name}</strong>
            <pre>{JSON.stringify(entry.request, null, 2)}</pre>
          </li>
        ))}
      </ol>
      <p className="actions">
        <Link className="link" to={ROUTES.confirm}>Back to review</Link>
        <Link className="link" to={ROUTES.location} onClick={clearAnswers}>Start over</Link>
      </p>
    </Card>
  );
}
