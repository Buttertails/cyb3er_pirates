import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COMPANIES } from '../../js/options.js';
import {
  AnswerList,
  Card,
  EstimateCard,
  SequenceCard,
  useDocumentTitle,
  useFlowGuard,
} from '../components.jsx';
import { deleteSavedPlan, fetchAppointments, fetchBenefits, fetchProcedures, fetchSavedPlans, submitErrorMessage } from '../lib/api.js';
import { DEMO_EMPLOYEES } from '../lib/demoEmployees.js';
import {
  describeProcedure,
  dollars,
  formatLocation,
  labelFor,
  officeLabel,
  readStep,
  ROUTES,
  saveStep,
  startUpdate,
} from '../lib/storage.js';

function formatSavedDate(iso) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  return new Date(time).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function ProfilePage() {
  useDocumentTitle('Your profile');
  const { saved, blocked } = useFlowGuard([]);
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState({ appointments: [], sample: false });
  const [procedures, setProcedures] = useState([]);
  const [employeeId, setEmployeeId] = useState(() => readStep('demo_employee_id') || '');
  const [benefits, setBenefits] = useState(null);
  const [savedPlans, setSavedPlans] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    setProcedures([]);
    setBenefits(null);
    setSavedPlans([]);
    setLoadError('');
    fetchAppointments().then((value) => { if (active) setAppointments(value); }).catch(() => {});
    if (employeeId) Promise.all([
      fetchProcedures(employeeId),
      fetchBenefits(employeeId),
      fetchSavedPlans(employeeId),
    ]).then(([reports, summary, savedItems]) => {
      if (!active) return;
      setProcedures(reports);
      setBenefits(summary.benefits);
      setSavedPlans(savedItems);
    }).catch((error) => { if (active) setLoadError(submitErrorMessage(error)); });
    return () => { active = false; };
  }, [employeeId]);

  async function removeSaved(id) {
    const previous = savedPlans;
    setSavedPlans((items) => items.filter((item) => item.id !== id));
    try {
      await deleteSavedPlan(id, employeeId);
    } catch {
      setSavedPlans(previous); // restore on failure
    }
  }

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

      <h2 className="subhead">Fictional plan and usage</h2>
      <div className="field">
        <label htmlFor="profile-employee">Demo employee</label>
        <select id="profile-employee" value={employeeId} onChange={(event) => {
          const selected = event.target.value;
          saveStep('demo_employee_id', selected || null);
          setEmployeeId(selected);
        }}>
          <option value="">Choose a demo employee</option>
          {DEMO_EMPLOYEES.map((employee) => <option key={employee.id} value={employee.id}>{employee.label}</option>)}
        </select>
      </div>
      {loadError && <p className="error" role="alert">{loadError}</p>}
      {benefits && <AnswerList rows={[
        ['Plan', benefits.plan_name],
        ['Annual maximum', dollars(benefits.annual_maximum)],
        ['Used this plan year', dollars(benefits.used)],
        ['Remaining', dollars(benefits.remaining)],
      ]} />}
      <p className="note">Fictional plan data. Confirmed care for this employee is included in the usage shown above.</p>

      <h2 className="subhead">Saved estimates &amp; plans</h2>
      {!employeeId && <p className="lead">Choose a demo employee to view their saved items.</p>}
      {employeeId && savedPlans.length === 0 && (
        <p className="lead">Nothing saved yet. Save an estimate or a care plan from the assistant to see it here.</p>
      )}
      {savedPlans.map((item) => (
        <div className="saved-item" key={item.id}>
          <div className="saved-item-head">
            <p className="step">
              {item.kind === 'sequence' ? 'Care plan' : 'Estimate'}
              {item.label ? ` · ${item.label}` : ''}
            </p>
            <button type="button" className="link-btn" onClick={() => removeSaved(item.id)}>Remove</button>
          </div>
          {item.saved_at && <p className="saved-item-date">Saved {formatSavedDate(item.saved_at)}</p>}
          {item.kind === 'sequence'
            ? <SequenceCard sequence={item.result} />
            : <EstimateCard estimate={item.result} />}
        </div>
      ))}

      <h2 className="subhead">Appointments</h2>
      {appointments.sample && dated.length > 0 && (
        <p className="note">Sample appointments: scheduling isn't connected yet.</p>
      )}
      {dated.length === 0 && <p className="lead">No appointments yet.</p>}
      {upcoming.length > 0 && <ProfileList title="Upcoming" items={upcoming.map(describeAppointment)} />}
      {past.length > 0 && <ProfileList title="Past" items={past.map(describeAppointment)} />}

      <h2 className="subhead">Confirmed dental work</h2>
      {!employeeId && <p className="lead">Choose a demo employee to view their records.</p>}
      {procedures.length === 0 ? (
        <p className="lead">Nothing recorded yet.</p>
      ) : (
        <div className="summary-group">
          {procedures.slice().sort((a, b) => b.date.localeCompare(a.date)).map((entry) => (
            <p className="summary" key={entry.id}><span>{describeProcedure(entry)}</span></p>
          ))}
        </div>
      )}
      <button type="button" className="btn" disabled={!employeeId} onClick={() => navigate(startUpdate('manual', ROUTES.profile))}>
        Update recent visits
      </button>
      <p className="actions"><Link className="link" to={ROUTES.chat}>Find a dental office</Link></p>
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
