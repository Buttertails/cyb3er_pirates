import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COMPANIES } from '../../js/options.js';
import {
  AnswerList,
  Card,
  ComparisonCard,
  EstimateCard,
  LincolnLoader,
  SequenceCard,
  useDocumentTitle,
  useFlowGuard,
} from '../components.jsx';
import { deleteSavedPlan, fetchAppointments, fetchBenefits, fetchProcedures, fetchSavedPlans, submitErrorMessage } from '../lib/api.js';
import { employeeIdForCompany } from '../lib/demoEmployees.js';
import {
  benefitsReminderNote,
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

const SAVED_KIND_LABEL = {
  estimate: 'Estimate',
  sequence: 'Care plan',
  comparison: 'Network comparison',
};

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
  const employeeId = readStep('demo_employee_id') || employeeIdForCompany(readStep('company'));
  const [benefits, setBenefits] = useState(null);
  const [savedPlans, setSavedPlans] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(Boolean(employeeId));
  // Set by the sign-in page when the user arrives from the benefits reminder email.
  const [reminder] = useState(() => readStep('reminder'));

  useEffect(() => {
    if (reminder) saveStep('reminder', null);
  }, [reminder]);

  useEffect(() => {
    let active = true;
    saveStep('demo_employee_id', employeeId);
    setProcedures([]);
    setBenefits(null);
    setSavedPlans([]);
    setLoadError('');
    setLoading(Boolean(employeeId));
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
    }).catch((error) => { if (active) setLoadError(submitErrorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employeeId]);

  async function removeSaved(id) {
    const previous = savedPlans;
    setSavedPlans((items) => items.filter((item) => item.id !== id));
    try {
      await deleteSavedPlan(id, employeeId);
    } catch (error) {
      setSavedPlans(previous); // restore on failure
      setLoadError(submitErrorMessage(error));
    }
  }

  if (blocked) return null;
  const notProvided = 'Not provided';
  const reminderNote = reminder === 'benefits' ? benefitsReminderNote(benefits) : null;
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

      <h2 className="subhead">Your plan and usage</h2>
      {loadError && <p className="error" role="alert">{loadError}</p>}
      {loading && <LincolnLoader label="Loading your plan…" className="lincoln-loader-block" />}
      {reminderNote && <p className="note" role="status">{reminderNote}</p>}
      {benefits && <AnswerList rows={[
        ['Plan', benefits.plan_name],
        ['Annual maximum', dollars(benefits.annual_maximum)],
        ['Used this plan year', dollars(benefits.used)],
        ['Remaining', dollars(benefits.remaining)],
      ]} />}
      <p className="note">Confirmed care is included in the usage shown above. Estimates may differ from a final claim.</p>

      <h2 className="subhead">Saved estimates &amp; plans</h2>
      {!employeeId && <p className="lead">Select a supported company plan to view saved items.</p>}
      {employeeId && !loading && savedPlans.length === 0 && (
        <p className="lead">Nothing saved yet. Save an estimate or a care plan from the assistant to see it here.</p>
      )}
      {savedPlans.map((item) => (
        <div className="saved-item" key={item.id}>
          <div className="saved-item-head">
            <p className="step">
              {SAVED_KIND_LABEL[item.kind] || 'Estimate'}
              {item.label ? ` · ${item.label}` : ''}
            </p>
            <button type="button" className="link-btn" onClick={() => removeSaved(item.id)}>Remove</button>
          </div>
          {item.saved_at && <p className="saved-item-date">Saved {formatSavedDate(item.saved_at)}</p>}
          {item.kind === 'sequence' && <SequenceCard sequence={item.result} />}
          {item.kind === 'comparison' && <ComparisonCard comparison={item.result} />}
          {item.kind === 'estimate' && <EstimateCard estimate={item.result} />}
        </div>
      ))}

      <h2 className="subhead">Appointments</h2>
      {appointments.sample && dated.length > 0 && (
        <p className="note">Appointment scheduling isn't connected yet.</p>
      )}
      {dated.length === 0 && <p className="lead">No appointments yet.</p>}
      {upcoming.length > 0 && <ProfileList title="Upcoming" items={upcoming.map(describeAppointment)} />}
      {past.length > 0 && <ProfileList title="Past" items={past.map(describeAppointment)} />}

      <h2 className="subhead">Confirmed dental work</h2>
      {loading ? null : procedures.length === 0 ? (
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
