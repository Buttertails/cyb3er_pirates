import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COMPANIES, DEMO_PLAN } from '../../js/options.js';
import {
  AnswerList,
  Card,
  useDocumentTitle,
  useFlowGuard,
} from '../components.jsx';
import { fetchAppointments, fetchProcedures } from '../lib/api.js';
import {
  describeProcedure,
  dollars,
  formatLocation,
  labelFor,
  officeLabel,
  ROUTES,
  startUpdate,
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
