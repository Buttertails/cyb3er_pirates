import { useEffect, useReducer, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from './lib/auth.js';
import { SignedOutError, submitErrorMessage } from './lib/api.js';
import {
  firstMissing,
  inOnboarding,
  inUpdate,
  readStep,
  requiredFlow,
  ROUTES,
  startUpdate,
  stepPosition,
} from './lib/storage.js';
import { animate } from 'animejs';
import purpleWave from '../res/purple-wave.svg';
import orangeWave from '../res/orange-wave.svg';
import lightPurpleWave from '../res/light-purple-wave.svg';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = `${title} | Lincoln Financial`;
  }, [title]);
}

export function useSessionUser() {
  const [, refresh] = useReducer((version) => version + 1, 0);
  useEffect(() => {
    window.addEventListener('session-change', refresh);
    return () => window.removeEventListener('session-change', refresh);
  }, []);
  return readStep('user');
}

export function Header() {
  const user = useSessionUser();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const showNav = Boolean(user) && !inOnboarding();
  const showAccount = Boolean(user) && pathname !== ROUTES.signIn && pathname !== '/';

  async function handleSignOut() {
    await signOut();
    navigate(ROUTES.signIn);
  }

  function handleUpdate() {
    const here = `${window.location.pathname}${window.location.search}`;
    navigate(startUpdate('manual', here));
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="topbar-brand" to={showNav ? ROUTES.chat : ROUTES.signIn}>
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Lincoln Financial</span>
        </Link>
        {showAccount && (
          <nav className="topbar-nav" aria-label="Account">
            {showNav && (
              <>
                <Link
                  className="topbar-item"
                  to={ROUTES.profile}
                  aria-current={pathname === ROUTES.profile ? 'page' : undefined}
                >
                  Account
                </Link>
                <button className="topbar-item" type="button" onClick={handleUpdate}>
                  Update dental history
                </button>
              </>
            )}
            <span className="topbar-user" title={user}>{user}</span>
            <button className="topbar-item topbar-signout" type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}

export function Card({ children, className = '', ref }) {
  return <main ref={ref} className={`card ${className}`.trim()}>{children}</main>;
}

export function Progress({ step, complete = false }) {
  const position = step ? stepPosition(step) : { current: 1, total: 1 };
  const percent = complete ? 100 : Math.round((position.current / position.total) * 100);
  return (
    <>
      <div className="progress" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
      {step && <p className="step">Step {position.current} of {position.total}</p>}
    </>
  );
}

export function ChoiceCards({ name, items, value, onChange }) {
  return (
    <div>
      {items.map((item) => (
        <label className="option" key={item.id}>
          <input
            type="radio"
            name={name}
            value={item.id}
            checked={value === item.id}
            onChange={(event) => onChange(event.target.value)}
          />
          <span className="option-body">
            <span className="option-title">{item.label ?? item.name}</span>
            <span className="option-desc">{item.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function ChoiceForm({
  name, items, value, onChange, onSubmit, busy = false, error = '', buttonLabel = 'Continue',
}) {
  return (
    <form onSubmit={onSubmit}>
      <fieldset>
        <legend>Select one</legend>
        <ChoiceCards name={name} items={items} value={value} onChange={onChange} />
      </fieldset>
      <button type="submit" className="btn" disabled={!value || busy}>
        {busy ? <><LincolnLoader />Please wait…</> : buttonLabel}
      </button>
      <FormError message={error} />
    </form>
  );
}

export function SummaryRow({ label, value, to, onLink, linkLabel = 'Change' }) {
  if (!value) return null;
  return (
    <p className="summary">
      <span>{label}: <strong>{value}</strong></span>
      {to && <Link className="link" to={to} onClick={onLink}>{linkLabel}</Link>}
    </p>
  );
}

export function AnswerList({ rows }) {
  return (
    <dl className="answers">
      {rows.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

function money(value) {
  return (Number(value) || 0).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export function EstimateCard({ estimate }) {
  const line = estimate?.lines?.[0];
  if (!line) return null;
  const totals = estimate.totals || {};
  const breakdown = [
    ['Procedure cost', money(line.allowed_amount)],
    ['Coverage', line.covered
      ? `${Math.round((line.coverage_rate || 0) * 100)}% of allowed cost`
      : 'Not covered by this plan'],
    ...(line.deductible_applied ? [['Deductible applied', money(line.deductible_applied)]] : []),
    ...(typeof estimate.annual_max_remaining_after === 'number'
      ? [['Annual maximum left after this', money(estimate.annual_max_remaining_after)]] : []),
  ];
  return (
    <div className="estimate">
      {estimate._local_demo && (
        <p className="estimate-flag">Approximate estimate from this browser session.</p>
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
        This is an approximate estimate, not a final claims decision or clinical advice.
      </p>
    </div>
  );
}

export function DentistResults({ result }) {
  if (!result) return null;
  const offices = result.status === 'ok' && Array.isArray(result.offices) ? result.offices : [];
  return (
    <section className="dentist-results" aria-label="Nearby dentist results">
      <p>{result.message}</p>
      {offices.length > 0 && (
        <>
          <p className="dentist-disclosure">These are fictional sample offices. Ratings, phone numbers, and network status are unverified demo data. Map pins show sample locations.</p>
          <ol className="dentist-list">
            {offices.map((office) => (
              <li className="dentist-card" key={office.id}>
                <strong>{office.name}</strong>
                <span>{office.address}</span>
                <span>Approximately {office.distance_miles} miles away · Sample rating {office.rating}/5</span>
                <span>Fictional phone: {office.phone}</span>
                <a href={office.maps_url} target="_blank" rel="noopener noreferrer">Open in Maps</a>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

export function SequenceCard({ sequence }) {
  if (!sequence || !Array.isArray(sequence.schedule)) return null;
  const thisYear = sequence.schedule.filter((item) => item.when === 'this_year');
  const nextYear = sequence.schedule.filter((item) => item.when === 'next_year');
  const savings = Number(sequence.estimated_savings) || 0;

  function Group({ title, note, items }) {
    if (items.length === 0) return null;
    return (
      <div className="sequence-group">
        <p className="step">{title}</p>
        {note && <p className="sequence-note">{note}</p>}
        <div className="summary-group">
          {items.map((item) => (
            <p className="summary" key={item.procedure_id + item.when}>
              <span>
                <strong>{item.label}</strong>
                {' — '}plan pays {money(item.plan_pays)}, you pay {money(item.employee_owes)}
                {item.reasons?.length > 0 && (
                  <span className="muted"> · {item.reasons.join(' ')}</span>
                )}
              </span>
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="estimate sequence">
      {savings > 0 ? (
        <div className="cost-grid">
          <div className="cost-cell">
            <span className="cost-label">All in one year</span>
            <span className="cost-value">{money(sequence.estimated_cost_all_now)}</span>
          </div>
          <div className="cost-cell cost-cell-plan">
            <span className="cost-label">Recommended plan</span>
            <span className="cost-value">{money(sequence.estimated_cost_recommended)}</span>
          </div>
          <div className="cost-cell cost-cell-you">
            <span className="cost-label">You save</span>
            <span className="cost-value">{money(savings)}</span>
          </div>
        </div>
      ) : (
        <div className="cost-grid">
          <div className="cost-cell cost-cell-you">
            <span className="cost-label">Estimated out of pocket</span>
            <span className="cost-value">{money(sequence.estimated_cost_recommended)}</span>
          </div>
        </div>
      )}

      {sequence.summary && <p className="sequence-summary">{sequence.summary}</p>}

      <Group title="Do this plan year" items={thisYear} />
      <Group
        title="Schedule after the reset"
        note={sequence.next_plan_year_start
          ? `Your plan year resets on ${sequence.next_plan_year_start}, giving a fresh ${money(sequence.annual_maximum)} maximum.`
          : ''}
        items={nextYear}
      />

      <p className="disclaimer">
        Timing suggestions are financial only, using fictional plan data — not clinical advice.
        Only you and your dentist can decide when care is safe to delay.
      </p>
    </div>
  );
}

export function ComparisonCard({ comparison }) {
  const inNet = comparison?.in_network;
  const outNet = comparison?.out_of_network;
  if (!inNet?.totals || !outNet?.totals) return null;
  const label = inNet.lines?.[0]?.label || outNet.lines?.[0]?.label || 'This procedure';
  const savings = Number(comparison.employee_savings_in_network) || 0;

  return (
    <div className="estimate comparison">
      <p className="comparison-title">{label}: in-network vs out-of-network</p>
      <div className="cost-grid">
        <div className="cost-cell cost-cell-plan">
          <span className="cost-label">You pay in-network</span>
          <span className="cost-value">{money(inNet.totals.employee_owes)}</span>
        </div>
        <div className="cost-cell">
          <span className="cost-label">You pay out-of-network</span>
          <span className="cost-value">{money(outNet.totals.employee_owes)}</span>
        </div>
        <div className="cost-cell cost-cell-you">
          <span className="cost-label">In-network saves</span>
          <span className="cost-value">{money(savings)}</span>
        </div>
      </div>

      <AnswerList rows={[
        ['Plan pays in-network', money(inNet.totals.plan_pays)],
        ['Plan pays out-of-network', money(outNet.totals.plan_pays)],
      ]} />

      {comparison.recommendation && <p className="sequence-summary">{comparison.recommendation}</p>}

      <p className="disclaimer">
        Approximate figures from fictional plan data. Out-of-network coverage and
        provider charges vary; this is not a claims decision.
      </p>
    </div>
  );
}

// Lincoln's hat hops off his head while a request is in flight; render it only
// while busy so it stops when the request settles. Without a label it is
// decorative, for spots that already say they're waiting.
export function LincolnLoader({ label = '', className = '' }) {
  const a11y = label ? { role: 'status' } : { 'aria-hidden': true };
  return (
    <span className={`lincoln-loader ${className}`.trim()} {...a11y}>
      <span className="lincoln-loader-figure">
        <span className="lincoln-loader-head" />
        <span className="lincoln-loader-hat" />
      </span>
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  );
}

export function FormError({ message }) {
  return message ? <p className="error" role="alert">{message}</p> : null;
}

export function FieldError({ id, message }) {
  return <p className="error" id={id} role="alert" hidden={!message}>{message}</p>;
}

export function useFlowGuard(keys) {
  const navigate = useNavigate();
  const result = firstMissing(requiredFlow(keys));
  useEffect(() => {
    if (result.missing) navigate(result.missing.page, { replace: true });
  }, [navigate, result.missing?.page]);
  return { saved: result.saved, blocked: Boolean(result.missing) };
}

export function useSubmitTask() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(work, destination) {
    setBusy(true);
    setError('');
    try {
      const next = await work();
      navigate(next || destination);
      return true;
    } catch (cause) {
      if (cause instanceof SignedOutError) {
        await signOut();
        navigate(`${ROUTES.signIn}?signed-out=1`);
        return false;
      }
      setBusy(false);
      setError(submitErrorMessage(cause));
      return false;
    }
  }

  return { busy, error, setError, run };
}

// Components for background wave animations
export function PurpleBackground() {
  const bgRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (location.pathname === ROUTES.chat) {
      animate(bgRef.current, {
        translateY: -24,
        duration: 1200,
        easing: 'easeOutCubic'
      });
    } else {
      animate(bgRef.current, {
        translateX: 0,
        translateY: 0,
        duration: 1000,
        easing: 'easeOutCubic'
      });
    }
  }, [location.pathname]);
  return <img ref={bgRef} className="purple-bg" src={purpleWave} alt="" aria-hidden="true" />;
}

export function OrangeBackground() {
  return <img className="orange-bg" src={orangeWave} alt="" aria-hidden="true" />;
}

export function LightPurpleBackground() {
  return <img className="light-purple-bg" src={lightPurpleWave} alt="" aria-hidden="true" />;
}
