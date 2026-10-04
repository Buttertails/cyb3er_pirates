import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { STATES, TIMEFRAMES } from '../../js/options.js';
import {
  AnswerList,
  Card,
  Progress,
  useDocumentTitle,
  useFlowGuard,
} from '../components.jsx';
import {
  categoryById,
  clearAnswers,
  labelFor,
  officeLabel,
  readStep,
  ROUTES,
} from '../lib/storage.js';

export function SummaryPage() {
  useDocumentTitle('Temporary summary');
  const { saved, blocked } = useFlowGuard(['location', 'office', 'category', 'procedure']);
  const navigate = useNavigate();
  const category = categoryById(saved.category);

  useEffect(() => {
    if (blocked) return;
    if (!category || (!saved.timing && !category.skipTiming)) navigate(ROUTES.chat, { replace: true });
  }, [blocked, category, navigate, saved.timing]);

  if (blocked || !category || (!saved.timing && !category.skipTiming)) return null;
  const state = STATES.find((item) => item.code === saved.location.state);
  const timing = saved.timing || 'asap';
  const sent = readStep('sent_log') || [];
  const mode = sent.length === 0
    ? 'No messages were recorded for this session.'
    : sent[0].mode === 'browser_intake'
      ? 'Your selections were saved for this session.'
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
        <Link className="link" to={ROUTES.chat}>Back to the chat</Link>
        <Link className="link" to={ROUTES.chat} onClick={clearAnswers}>Start over</Link>
      </p>
    </Card>
  );
}
