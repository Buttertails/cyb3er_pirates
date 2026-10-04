import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CATEGORIES,
  STATES,
  TIMEFRAMES,
} from '../../js/options.js';
import {
  Card,
  ChoiceForm,
  FieldError,
  IntakeSummary,
  Progress,
  useDocumentTitle,
  useFlowGuard,
  useSubmitTask,
} from '../components.jsx';
import {
  finishFlow,
  saveProfileDetails,
  saveProfileLocation,
  sendStep,
  sendSteps,
} from '../lib/api.js';
import {
  categoryById,
  formatLocation,
  inOnboarding,
  inUpdate,
  isLastStep,
  labelFor,
  nextPage,
  officeLabel,
  ROUTES,
  saveStep,
  savedOffices,
  stateName,
  statesForZip,
  zipFitsState,
} from '../lib/storage.js';

export function LocationPage() {
  useDocumentTitle('Where are you?');
  const { saved, blocked } = useFlowGuard([]);
  const [state, setState] = useState(saved.location?.state || '');
  const [zip, setZip] = useState(saved.location?.zip || '');
  const [errors, setErrors] = useState({});
  const task = useSubmitTask();

  function zipProblem(value, selectedState) {
    if (!value) return '';
    if (!/^\d{5}$/.test(value)) return 'Enter a 5-digit ZIP code, or leave it blank.';
    if (selectedState && !zipFitsState(value, selectedState)) {
      const actual = statesForZip(value).map(stateName).join(' or ');
      return `ZIP code ${value} is in ${actual}, not ${stateName(selectedState)}. Check your state and ZIP code.`;
    }
    return '';
  }

  function submit(event) {
    event.preventDefault();
    const trimmedZip = zip.trim();
    const nextErrors = {
      state: state ? '' : 'Please select a state.',
      zip: zipProblem(trimmedZip, state),
    };
    setErrors(nextErrors);
    if (nextErrors.state || nextErrors.zip) return;
    saveStep('location', { state, zip: trimmedZip });
    task.run(async () => {
      await saveProfileLocation(state, trimmedZip || null);
      await sendStep('location', { state, zip: trimmedZip || null });
    }, nextPage('location'));
  }

  if (blocked) return null;
  return (
    <Card>
      <Progress step="location" />
      <h1>Where are you located?</h1>
      <p className="lead">We use this to find dental options near you.</p>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="state">State</label>
          <select
            id="state"
            value={state}
            onChange={(event) => setState(event.target.value)}
            autoComplete="address-level1"
            aria-invalid={Boolean(errors.state)}
            aria-describedby="state-error"
          >
            <option value="">Select a state</option>
            {STATES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
          <FieldError id="state-error" message={errors.state} />
        </div>
        <div className="field">
          <label htmlFor="zip">ZIP code <span className="optional">(optional)</span></label>
          <input
            id="zip"
            value={zip}
            onChange={(event) => setZip(event.target.value)}
            type="text"
            inputMode="numeric"
            maxLength={5}
            autoComplete="postal-code"
            aria-invalid={Boolean(errors.zip)}
            aria-describedby="zip-error"
          />
          <FieldError id="zip-error" message={errors.zip} />
        </div>
        <button className="btn" type="submit" disabled={task.busy}>
          {task.busy ? 'Please wait…' : 'Continue'}
        </button>
        <FieldError message={task.error} />
      </form>
    </Card>
  );
}

export function OfficePage() {
  useDocumentTitle('Choose an office');
  const { saved, blocked } = useFlowGuard(['location']);
  const [choice, setChoice] = useState(saved.office || '');
  const task = useSubmitTask();
  const offices = savedOffices();
  const savesToProfile = inOnboarding() || inUpdate();
  const items = offices.map((office) => ({
    id: office.id,
    label: office.name,
    description: [
      office.address,
      typeof office.distance_miles === 'number' ? `${office.distance_miles} mi away` : '',
    ].filter(Boolean).join(' · '),
  }));

  function submit(event) {
    event.preventDefault();
    if (!choice) return;
    saveStep('office', choice);
    const last = isLastStep('office');
    task.run(async () => {
      if (savesToProfile) await saveProfileDetails({ office: choice });
      await sendStep('office', { office: choice });
      if (last) await finishFlow();
    }, nextPage('office'));
  }

  if (blocked) return null;
  return (
    <Card>
      <Progress step="office" />
      <h1>{savesToProfile ? 'Which dental office do you go to?' : 'Choose a dental office near you'}</h1>
      <IntakeSummary saved={saved} rows={[
        { key: 'location', label: 'Location', to: ROUTES.location },
      ]} />
      {offices.length === 0 ? (
        <p className="note" role="status">
          We couldn't find any dental offices near this location. Try a different state or ZIP code.
        </p>
      ) : (
        <ChoiceForm
          name="office"
          items={items}
          value={choice}
          onChange={setChoice}
          onSubmit={submit}
          busy={task.busy}
          error={task.error}
        />
      )}
    </Card>
  );
}

export function CategoryPage() {
  useDocumentTitle('What kind of care?');
  const { saved, blocked } = useFlowGuard(['location', 'office']);
  const [choice, setChoice] = useState(saved.category || '');
  const task = useSubmitTask();

  function submit(event) {
    event.preventDefault();
    if (choice !== saved.category) {
      saveStep('procedure', null);
      if (categoryById(saved.category)?.skipTiming) saveStep('timing', null);
    }
    saveStep('category', choice);
    task.run(() => sendSteps([
      { step: 'category', parameters: { category: choice } },
    ]), ROUTES.procedure);
  }

  if (blocked) return null;
  return (
    <Card>
      <Progress step="category" />
      <h1>What kind of care do you need?</h1>
      <IntakeSummary saved={saved} rows={[
        { key: 'location', label: 'Location', to: ROUTES.location },
        { key: 'office', label: 'Office', to: ROUTES.office },
      ]} />
      <ChoiceForm
        name="category"
        items={CATEGORIES}
        value={choice}
        onChange={setChoice}
        onSubmit={submit}
        busy={task.busy}
        error={task.error}
      />
    </Card>
  );
}

export function ProcedurePage() {
  useDocumentTitle('What do you need?');
  const { saved, blocked } = useFlowGuard(['location', 'office', 'category']);
  const navigate = useNavigate();
  const category = categoryById(saved.category);
  const savedChoice = category?.procedures.some((item) => item.id === saved.procedure)
    ? saved.procedure : '';
  const [choice, setChoice] = useState(savedChoice);
  const task = useSubmitTask();

  useEffect(() => {
    if (!blocked && !category) navigate(ROUTES.category, { replace: true });
  }, [blocked, category, navigate]);

  function submit(event) {
    event.preventDefault();
    saveStep('procedure', choice);
    const pieces = [{ step: 'procedure', parameters: { procedure: choice } }];
    let destination = ROUTES.timing;
    if (category.skipTiming) {
      saveStep('timing', 'asap');
      pieces.push({ step: 'timing', parameters: { timing: 'asap' }, autoSet: true });
      destination = ROUTES.confirm;
    }
    task.run(() => sendSteps(pieces), destination);
  }

  if (blocked || !category) return null;
  return (
    <Card>
      <Progress step="procedure" />
      <h1>{category.prompt}</h1>
      <IntakeSummary saved={saved} rows={[
        { key: 'location', label: 'Location', to: ROUTES.location },
        { key: 'office', label: 'Office', to: ROUTES.office },
        { key: 'category', label: 'Care type', value: category.label, to: ROUTES.category },
      ]} />
      <ChoiceForm
        name="procedure"
        items={category.procedures}
        value={choice}
        onChange={setChoice}
        onSubmit={submit}
        busy={task.busy}
        error={task.error}
      />
    </Card>
  );
}

export function TimingPage() {
  useDocumentTitle('When do you need it?');
  const { saved, blocked } = useFlowGuard(['location', 'office', 'category', 'procedure']);
  const navigate = useNavigate();
  const category = categoryById(saved.category);
  const [choice, setChoice] = useState(saved.timing || '');
  const task = useSubmitTask();

  useEffect(() => {
    if (!blocked && category?.skipTiming) navigate(ROUTES.confirm, { replace: true });
  }, [blocked, category, navigate]);

  function submit(event) {
    event.preventDefault();
    saveStep('timing', choice);
    task.run(() => sendStep('timing', { timing: choice }), ROUTES.confirm);
  }

  if (blocked || !category || category.skipTiming) return null;
  return (
    <Card>
      <Progress step="timing" />
      <h1>When do you need it done?</h1>
      <IntakeSummary saved={saved} rows={[
        { key: 'location', label: 'Location', to: ROUTES.location },
        { key: 'office', label: 'Office', to: ROUTES.office },
        {
          key: 'procedure',
          label: 'Procedure',
          value: labelFor(category.procedures, saved.procedure),
          to: ROUTES.procedure,
        },
      ]} />
      <ChoiceForm
        name="timing"
        items={TIMEFRAMES}
        value={choice}
        onChange={setChoice}
        onSubmit={submit}
        busy={task.busy}
        error={task.error}
      />
    </Card>
  );
}
