import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  COMPANIES,
  DEMO_PLAN,
  HISTORY_CATEGORIES,
} from '../../js/options.js';
import {
  AnswerList,
  Card,
  ChoiceForm,
  FieldError,
  Progress,
  useDocumentTitle,
  useFlowGuard,
  useSubmitTask,
} from '../components.jsx';
import {
  fetchAppointments,
  fetchProcedures,
  finishFlow,
  saveProcedures,
} from '../lib/api.js';
import {
  describeProcedure,
  dollars,
  formatDay,
  formatLocation,
  inUpdate,
  labelFor,
  nextPage,
  officeLabel,
  procedureLabel,
  readStep,
  ROUTES,
  saveStep,
  startUpdate,
  UPDATE,
  yesNoOptions,
} from '../lib/storage.js';

export function ProfilePage() {
  useDocumentTitle('Your profile');
  const { saved, blocked } = useFlowGuard([]);
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState({ appointments: [], sample: false });
  const [procedures, setProcedures] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchAppointments(), fetchProcedures()]).then(([appointmentResult, procedureResult]) => {
      if (!active) return;
      if (appointmentResult.status === 'fulfilled') setAppointments(appointmentResult.value);
      if (procedureResult.status === 'fulfilled') setProcedures(procedureResult.value);
    });
    return () => { active = false; };
  }, []);

  if (blocked) return null;
  const notProvided = 'Not provided';
  const now = Date.now();
  const dated = appointments.appointments.filter((item) => !Number.isNaN(Date.parse(item.starts_at)));
  const upcoming = dated.filter((item) => Date.parse(item.starts_at) >= now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const past = dated.filter((item) => Date.parse(item.starts_at) < now)
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));

  function describeAppointment(appointment) {
    const start = new Date(appointment.starts_at);
    const day = start.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
    const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return [day, time, appointment.office_name, appointment.reason].filter(Boolean).join(' · ');
  }

  return (
    <Card>
      <p className="step">Profile</p>
      <h1>Your profile</h1>
      <AnswerList rows={[
        ['Name', saved.name || notProvided],
        ['Email', saved.user],
        ['Company', saved.company ? labelFor(COMPANIES, saved.company) : notProvided],
        ['Location', saved.location ? formatLocation(saved.location) : notProvided],
        ['Dental office', saved.office ? officeLabel(saved.office) : notProvided],
      ]} />

      <h2 className="subhead">Your plan</h2>
      <AnswerList rows={[
        ['Plan', DEMO_PLAN.name],
        ['Covers', DEMO_PLAN.covered.join(', ')],
        ['Annual maximum', DEMO_PLAN.maxCoverage > 0 ? dollars(DEMO_PLAN.maxCoverage) : 'None'],
        ['Deductible', DEMO_PLAN.deductible ? dollars(DEMO_PLAN.deductible) : 'None'],
      ]} />
      <p className="note">Placeholder: your actual plan isn't connected to your profile yet.</p>

      <h2 className="subhead">Appointments</h2>
      {appointments.sample && dated.length > 0 && (
        <p className="note">Sample appointments: scheduling isn't connected yet.</p>
      )}
      {dated.length === 0 && <p className="lead">No appointments yet.</p>}
      {upcoming.length > 0 && <ProfileList title="Upcoming" items={upcoming.map(describeAppointment)} />}
      {past.length > 0 && <ProfileList title="Past" items={past.map(describeAppointment)} />}

      <h2 className="subhead">Recent dental work</h2>
      {procedures.length === 0 ? (
        <p className="lead">Nothing recorded yet.</p>
      ) : (
        <div className="summary-group">
          {procedures.slice().sort((a, b) => b.date.localeCompare(a.date)).map((entry) => (
            <p className="summary" key={entry.id}><span>{describeProcedure(entry)}</span></p>
          ))}
        </div>
      )}
      <button type="button" className="btn" onClick={() => navigate(startUpdate('manual', ROUTES.profile))}>
        Update recent visits
      </button>
      <p className="actions"><Link className="link" to={ROUTES.office}>Find a dental office</Link></p>
    </Card>
  );
}

function ProfileList({ title, items }) {
  return (
    <div>
      <p className="step">{title}</p>
      <div className="summary-group">
        {items.map((item) => <p className="summary" key={item}><span>{item}</span></p>)}
      </div>
    </div>
  );
}

export function LocationCheckPage() {
  useDocumentTitle('Still here?');
  const { saved, blocked } = useFlowGuard([]);
  const navigate = useNavigate();
  const [choice, setChoice] = useState(saved['location-check'] || '');
  const task = useSubmitTask();

  useEffect(() => {
    if (blocked) return;
    if (!inUpdate()) {
      navigate(UPDATE[0].page, { replace: true });
      return;
    }
    if (!saved.location) {
      saveStep('still_here', 'no');
      navigate(nextPage('location-check'), { replace: true });
    }
  }, [blocked, navigate, saved.location]);

  function submit(event) {
    event.preventDefault();
    saveStep('still_here', choice);
    const next = nextPage('location-check');
    if (choice === 'no') navigate(next);
    else task.run(finishFlow, next);
  }

  if (blocked || !inUpdate() || !saved.location) return null;
  const items = yesNoOptions(
    "Yes, I'm still here", 'Keep my location and dental office',
    "No, I've moved", 'Enter where you are now',
  );
  return (
    <Card>
      <Progress step="location-check" />
      <h1>Are you still in {formatLocation(saved.location)}?</h1>
      <p className="lead">We use this to suggest dental offices near you.</p>
      {saved.office && (
        <div className="summary-group">
          <p className="summary"><span>Your dental office: <strong>{officeLabel(saved.office)}</strong></span></p>
        </div>
      )}
      <ChoiceForm
        name="still_here"
        items={items}
        value={choice}
        onChange={setChoice}
        onSubmit={submit}
        busy={task.busy}
        error={task.error}
      />
    </Card>
  );
}

function emptyEntry() {
  return { procedure: '', date: '', cost: '', you_paid: '', insurance_paid: '' };
}

export function ProceduresPage() {
  useDocumentTitle('Recent dental work');
  const { blocked } = useFlowGuard([]);
  const initialDraft = useMemo(() => readStep('procedures_draft') || { hadWork: '', entries: [] }, []);
  const [hadWork, setHadWork] = useState(initialDraft.hadWork || '');
  const [entries, setEntries] = useState(initialDraft.entries || []);
  const [entry, setEntry] = useState(emptyEntry);
  const [errors, setErrors] = useState({});
  const [recorded, setRecorded] = useState([]);
  const task = useSubmitTask();
  const stale = readStep('update_reason') === 'stale';
  const since = stale ? formatDay(readStep('previous_sign_in')) : '';
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    if (!inUpdate()) startUpdate('manual', ROUTES.office);
    fetchProcedures().then(setRecorded).catch(() => {});
  }, []);

  useEffect(() => {
    saveStep('procedures_draft', { hadWork, entries });
  }, [hadWork, entries]);

  function parseAmount(text) {
    const cleaned = text.replace(/[$,\s]/g, '');
    if (!cleaned) return null;
    return /^\d+(\.\d{1,2})?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
  }

  function addEntry() {
    const amounts = {
      cost: parseAmount(entry.cost),
      you_paid: parseAmount(entry.you_paid),
      insurance_paid: parseAmount(entry.insurance_paid),
    };
    const nextErrors = {
      procedure: entry.procedure ? '' : 'Choose the procedure you had.',
      date: !entry.date ? 'Enter the month it was done.'
        : entry.date > thisMonth ? 'Choose a month that has already happened.' : '',
    };
    Object.entries(amounts).forEach(([key, value]) => {
      nextErrors[key] = Number.isNaN(value)
        ? 'Enter an amount like 120 or 120.50, or leave it blank.' : '';
    });
    const paid = (amounts.you_paid || 0) + (amounts.insurance_paid || 0);
    if (!nextErrors.cost && amounts.cost != null && paid > amounts.cost) {
      nextErrors.cost = 'What you and insurance paid adds up to more than the total cost.';
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return false;

    const category = HISTORY_CATEGORIES.find((item) =>
      item.procedures.some((procedure) => procedure.id === entry.procedure));
    setEntries((current) => current.concat({
      procedure: entry.procedure,
      category: category.id,
      date: entry.date,
      ...amounts,
    }));
    setEntry(emptyEntry());
    task.setError('');
    return true;
  }

  function submit(event) {
    event.preventDefault();
    if (!hadWork) return;
    let nextEntries = entries;
    if (hadWork === 'yes') {
      const hasTypedEntry = Object.values(entry).some((value) => value.trim() !== '');
      if (hasTypedEntry) {
        if (!addEntry()) return;
        const amounts = {
          cost: parseAmount(entry.cost), you_paid: parseAmount(entry.you_paid),
          insurance_paid: parseAmount(entry.insurance_paid),
        };
        const category = HISTORY_CATEGORIES.find((item) =>
          item.procedures.some((procedure) => procedure.id === entry.procedure));
        nextEntries = entries.concat({
          procedure: entry.procedure, category: category.id, date: entry.date, ...amounts,
        });
      }
      if (nextEntries.length === 0) {
        task.setError('Add at least one procedure, or choose No.');
        return;
      }
    } else {
      nextEntries = [];
    }
    task.run(async () => {
      await saveProcedures(nextEntries);
      saveStep('procedures_saved', true);
      saveStep('procedures_draft', null);
    }, nextPage('procedures'));
  }

  function field(name, label, props = {}) {
    return (
      <div className="field">
        <label htmlFor={name}>{label}</label>
        <input
          id={name}
          value={entry[name]}
          onChange={(event) => setEntry((current) => ({ ...current, [name]: event.target.value }))}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={`${name}-error`}
          {...props}
        />
        <FieldError id={`${name}-error`} message={errors[name]} />
      </div>
    );
  }

  if (blocked) return null;
  const hadWorkItems = yesNoOptions('Yes', "I'll add each procedure", 'No', 'Nothing new since then');
  return (
    <Card>
      <Progress step="procedures" />
      {stale && (
        <p className="note" role="status">
          It's been more than 90 days since you last signed in. Before you continue, tell us about recent dental work.
        </p>
      )}
      <h1>Any recent dental work?</h1>
      <p className="lead">This keeps your coverage estimates accurate.</p>

      {recorded.length > 0 && (
        <div>
          <h2 className="subhead">Already on file</h2>
          <div className="summary-group">
            {recorded.map((item) => <p className="summary" key={item.id}><span>{describeProcedure(item)}</span></p>)}
          </div>
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <fieldset>
          <legend>{since
            ? `Have you had any dental work since ${since}?`
            : "Have you had any dental work that isn't on file yet?"}</legend>
          <div>
            {hadWorkItems.map((item) => (
              <label className="option" key={item.id}>
                <input
                  type="radio"
                  name="had_work"
                  value={item.id}
                  checked={hadWork === item.id}
                  onChange={(event) => setHadWork(event.target.value)}
                />
                <span className="option-body">
                  <span className="option-title">{item.label}</span>
                  <span className="option-desc">{item.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {hadWork === 'yes' && (
          <fieldset>
            <legend>Add a procedure</legend>
            <div className="field">
              <label htmlFor="procedure">Procedure</label>
              <select
                id="procedure"
                value={entry.procedure}
                onChange={(event) => setEntry((current) => ({ ...current, procedure: event.target.value }))}
                aria-invalid={Boolean(errors.procedure)}
                aria-describedby="procedure-error"
              >
                <option value="">Select a procedure</option>
                {HISTORY_CATEGORIES.map((category) => (
                  <optgroup label={category.label} key={category.id}>
                    {category.procedures.map((procedure) => (
                      <option value={procedure.id} key={procedure.id}>{procedure.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <FieldError id="procedure-error" message={errors.procedure} />
            </div>
            {field('date', 'Month it was done', { type: 'month', max: thisMonth })}
            {field('cost', <>Total cost in dollars <span className="optional">(optional)</span></>, { type: 'text', inputMode: 'decimal' })}
            {field('you_paid', <>You paid <span className="optional">(optional)</span></>, { type: 'text', inputMode: 'decimal' })}
            {field('insurance_paid', <>Insurance paid <span className="optional">(optional)</span></>, { type: 'text', inputMode: 'decimal' })}
            <button type="button" className="btn btn-secondary" onClick={addEntry}>Add procedure</button>
          </fieldset>
        )}

        {hadWork === 'yes' && entries.length > 0 && (
          <div className="summary-group">
            {entries.map((item, index) => (
              <p className="summary" key={`${item.procedure}-${item.date}-${index}`}>
                <span>{describeProcedure(item)}</span>
                <button
                  type="button"
                  className="link-btn"
                  aria-label={`Remove ${procedureLabel(item.procedure)}`}
                  onClick={() => setEntries((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >Remove</button>
              </p>
            ))}
          </div>
        )}
        <button type="submit" className="btn" disabled={!hadWork || task.busy}>
          {task.busy ? 'Please wait…' : 'Continue'}
        </button>
        <FieldError message={task.error} />
      </form>
    </Card>
  );
}
