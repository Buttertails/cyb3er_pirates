import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { COMPANIES, SIGNUP_QUESTIONS } from '../../js/options.js';
import {
  Card,
  ChoiceForm,
  FieldError,
  Progress,
  SummaryRow,
  useDocumentTitle,
  useSubmitTask,
} from '../components.jsx';
import { authMessage, demoLoginActive, signIn, signUp } from '../lib/auth.js';
import {
  fetchProfile,
  finishFlow,
  recordSignIn,
  saveProfileDetails,
  sendStep,
} from '../lib/api.js';
import {
  answeredSteps,
  clearSession,
  firstMissing,
  formatLocation,
  inOnboarding,
  isLastStep,
  nextPage,
  officeLabel,
  ONBOARDING,
  readStep,
  ROUTES,
  saveStep,
  signInIsStale,
  startUpdate,
} from '../lib/storage.js';
import { animate, createScope } from 'animejs';

export function SignInPage() {
  useDocumentTitle('Sign in');
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const root = useRef(null);
  const scopeRef = useRef(null);

  // Slide in animation on load
  useEffect(() => {
    scopeRef.current = createScope({ root: root.current });

    scopeRef.current.add(() => {
      animate('.login-card', {
        translateY: [150, 0],
        opacity: [0, 1],
        duration: 1350,
        ease: 'outBack',
      });
    });

    // 3. Cleanup: revert animations automatically when the component unmounts
    return () => {
      if (scopeRef.current) {
        scopeRef.current.revert();
      }
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {
      email: email.trim() ? '' : 'Enter your email.',
      password: password ? '' : 'Enter your password.',
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setBusy(true);
    setSubmitError('');
    let user;
    try {
      user = await signIn(email.trim(), password);
    } catch (error) {
      setBusy(false);
      setSubmitError(authMessage(error, "We couldn't sign you in just now. Please try again."));
      return;
    }

    try {
      clearSession();
      saveStep('user', user.email);
      const profile = await fetchProfile();
      ['name', 'company', 'office'].forEach((key) => {
        if (profile[key]) saveStep(key, profile[key]);
      });
      if (profile.location) {
        const savedLocation = { state: profile.location.state, zip: profile.location.zip || '' };
        saveStep('location', savedLocation);
        await sendStep('location', { state: savedLocation.state, zip: savedLocation.zip || null });
      }

      const answers = answeredSteps();
      const unanswered = ONBOARDING.find((step) => !answers[step.key]);
      if (unanswered) {
        await recordSignIn();
        saveStep('onboarding', true);
        navigate(unanswered.page);
      } else if (signInIsStale(profile.last_sign_in_at)) {
        saveStep('previous_sign_in', profile.last_sign_in_at);
        navigate(startUpdate('stale', ROUTES.office));
      } else {
        await recordSignIn();
        navigate(ROUTES.office);
      }
    } catch (error) {
      setBusy(false);
      setSubmitError("Sign-in succeeded, but the app couldn't load your profile. Start the backend, then try again.");
    }
  }

  return (
    <Card className="login-card">
      {demoLoginActive() && (
        <p className="temp-banner"><strong>Demo sign-in.</strong> Any email and password works.</p>
      )}
      {new URLSearchParams(location.search).has('signed-out') && (
        <p className="note" role="status">You were signed out. Please sign in again.</p>
      )}
      <h1>Sign in</h1>
      <p className="lead">Sign in to find a dental office and get started.</p>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck="false"
            aria-invalid={Boolean(errors.email)}
            aria-describedby="email-error"
          />
          <FieldError id="email-error" message={errors.email} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby="password-error"
          />
          <FieldError id="password-error" message={errors.password} />
        </div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <FieldError message={submitError} />
      </form>
      <p className="form-switch">New here? <Link className="link" to={ROUTES.signup}>Create an account</Link></p>
    </Card>
  );
}

export function SignupPage() {
  useDocumentTitle('Create an account');
  const location = useLocation();
  const navigate = useNavigate();
  const key = new URLSearchParams(location.search).get('q') || 'email';
  const question = SIGNUP_QUESTIONS[key];
  const index = ONBOARDING.findIndex((step) => step.key === key);
  const guard = useMemo(() => firstMissing(ONBOARDING.slice(0, Math.max(index, 0))), [key, index]);
  const saved = guard.saved;
  const [answer, setAnswer] = useState(key === 'password' ? '' : (saved[key] || ''));
  const [confirm, setConfirm] = useState(key === 'password' ? '' : (saved[key] || ''));
  const [choice, setChoice] = useState(saved[key] || '');
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const task = useSubmitTask();

  useEffect(() => {
    if (!question || index < 0) {
      navigate(ONBOARDING[0].page, { replace: true });
      return;
    }
    if (index > 0 && !inOnboarding()) {
      navigate(ONBOARDING[0].page, { replace: true });
      return;
    }
    if (index <= 1 && inOnboarding() && readStep('user')) {
      navigate(nextPage('password'), { replace: true });
      return;
    }
    if (index === 0 && !inOnboarding()) {
      clearSession();
      saveStep('onboarding', true);
    }
    if (guard.missing) navigate(guard.missing.page, { replace: true });
  }, [guard.missing, index, navigate, question]);

  useEffect(() => {
    setAnswer(key === 'password' ? '' : (saved[key] || ''));
    setConfirm(key === 'password' ? '' : (saved[key] || ''));
    setChoice(saved[key] || '');
    setErrors({});
    setAuthError('');
  }, [key]);

  if (!question || index < 0 || guard.missing) return null;

  const earlier = ONBOARDING.slice(0, index).map((step) => step.key);
  const summary = [
    { key: 'email', label: 'Email', value: earlier.includes('email') && !saved.user ? saved.email : '', to: `${ROUTES.signup}?q=email` },
    { key: 'name', label: 'Name', value: earlier.includes('name') ? saved.name : '', to: `${ROUTES.signup}?q=name` },
    { key: 'location', label: 'Location', value: earlier.includes('location') ? formatLocation(saved.location) : '', to: ROUTES.location },
    { key: 'office', label: 'Office', value: earlier.includes('office') ? officeLabel(saved.office) : '', to: ROUTES.office },
  ];

  function saveAnswer(value) {
    saveStep(key, value);
    const last = isLastStep(key);
    task.run(async () => {
      await saveProfileDetails({ [key]: value });
      if (last) await finishFlow();
    }, nextPage(key));
  }

  async function submitPassword(value) {
    task.setError('');
    setAuthError('');
    setAuthBusy(true);
    let user;
    try {
      user = await signUp(saved.email, value);
    } catch (error) {
      setAuthBusy(false);
      setAuthError(authMessage(error, "We couldn't create your account just now. Please try again."));
      return;
    }
    saveStep('user', user.email);
    navigate(nextPage('password'));
  }

  function submit(event) {
    event.preventDefault();
    if (question.kind === 'choice') {
      if (choice) saveAnswer(choice);
      return;
    }

    const value = question.type === 'password' ? answer : answer.trim();
    const confirmValue = question.type === 'password' ? confirm : confirm.trim();
    const noun = question.label.toLowerCase();
    let answerError = '';
    if (!value) answerError = `Enter your ${noun}.`;
    else if (question.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      answerError = 'Enter a valid email address.';
    } else if (question.minLength && value.length < question.minLength) {
      answerError = `Use at least ${question.minLength} characters.`;
    }
    const confirmError = question.confirmLabel && confirmValue !== value
      ? `The ${noun}s don't match.` : '';
    setErrors({ answer: answerError, confirm: confirmError });
    if (answerError || confirmError) return;

    if (key === 'email') {
      saveStep('signup_email', value);
      navigate(nextPage('email'));
    } else if (key === 'password') {
      submitPassword(value);
    } else {
      saveAnswer(value);
    }
  }

  return (
    <Card ref={root} className="login-card">
      <Progress step={key} />
      {index === 0 && demoLoginActive() && (
        <p className="temp-banner"><strong>Demo sign-in.</strong> Any email and password works.</p>
      )}
      <h1>{question.heading}</h1>
      <p className="lead">{question.lead}</p>
      {summary.some((row) => row.value) && (
        <div className="summary-group">
          {summary.map(({ key: rowKey, ...row }) => <SummaryRow key={rowKey} {...row} />)}
        </div>
      )}
      {question.kind === 'choice' ? (
        <ChoiceForm
          name={key}
          items={question.options || COMPANIES}
          value={choice}
          onChange={setChoice}
          onSubmit={submit}
          busy={task.busy || authBusy}
          error={task.error}
          buttonLabel={question.button}
        />
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="answer">{question.label}</label>
            <input
              id="answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              type={question.type}
              autoComplete={question.autocomplete}
              maxLength={question.maxLength}
              aria-invalid={Boolean(errors.answer)}
              aria-describedby="answer-error"
              autoFocus
            />
            <FieldError id="answer-error" message={errors.answer} />
          </div>
          {question.confirmLabel && (
            <div className="field">
              <label htmlFor="confirm">{question.confirmLabel}</label>
              <input
                id="confirm"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                type={question.type}
                autoComplete={question.autocomplete}
                maxLength={question.maxLength}
                aria-invalid={Boolean(errors.confirm)}
                aria-describedby="confirm-error"
              />
              <FieldError id="confirm-error" message={errors.confirm} />
            </div>
          )}
          <button className="btn" type="submit" disabled={task.busy || authBusy}>
            {task.busy || authBusy ? 'Please wait…' : question.button}
          </button>
          <FieldError message={authError || task.error} />
        </form>
      )}
      {index === 0 && (
        <p className="form-switch">Already have an account? <Link className="link" to={ROUTES.signIn}>Sign in</Link></p>
      )}
    </Card>
  );
}
