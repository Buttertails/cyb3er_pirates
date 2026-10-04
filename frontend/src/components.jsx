import { useEffect, useReducer, useState } from 'react';
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
  const showNav = Boolean(user) && !inOnboarding() && !inUpdate();

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
        {user && (
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

export function Card({ children, className = '' }) {
  return <main className={`card ${className}`.trim()}>{children}</main>;
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
        {busy ? 'Please wait…' : buttonLabel}
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
