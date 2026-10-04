import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EstimateCard, useDocumentTitle, useFlowGuard } from '../components.jsx';
import { sendLiveChat, SignedOutError, submitErrorMessage } from '../lib/api.js';
import { signOut } from '../lib/auth.js';
import { DEMO_EMPLOYEES } from '../lib/demoEmployees.js';
import { readStep, ROUTES, saveStep, startUpdate } from '../lib/storage.js';

export function LiveBenefitsChat() {
  useDocumentTitle('Dental benefits assistant');
  const { blocked } = useFlowGuard([]);
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState(() => readStep('demo_employee_id') || '');
  const [messages, setMessages] = useState([]);
  const [choices, setChoices] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const session = useRef(null);
  const latest = useRef(0);

  async function send(message, selected = employeeId, current = session.current) {
    const requestId = ++latest.current;
    setBusy(true);
    setError('');
    try {
      const result = await sendLiveChat(selected, current, message);
      if (requestId !== latest.current) return;
      session.current = result.session_id;
      setMessages((previous) => previous.concat(
        ...result.messages.map((text) => ({ from: 'bot', text })),
        ...(result.estimate ? [{ from: 'bot', estimate: result.estimate }] : []),
      ));
      setChoices(result.choices || []);
    } catch (cause) {
      if (requestId !== latest.current) return;
      if (cause instanceof SignedOutError) {
        await signOut();
        navigate(`${ROUTES.signIn}?signed-out=1`);
        return;
      }
      setError(submitErrorMessage(cause));
    } finally {
      if (requestId === latest.current) setBusy(false);
    }
  }

  useEffect(() => {
    if (blocked || !employeeId) return;
    setMessages([]);
    setChoices([]);
    session.current = null;
    send({ event: 'start' }, employeeId, null);
    return () => { latest.current += 1; };
  }, [blocked, employeeId]);

  function answer(value) {
    const text = value.trim();
    if (!employeeId || !text || busy) return;
    setMessages((previous) => previous.concat({ from: 'user', text }));
    setDraft('');
    setChoices([]);
    send({ text });
  }

  function chooseEmployee(event) {
    const selected = event.target.value;
    saveStep('demo_employee_id', selected || null);
    setEmployeeId(selected);
    setMessages([]);
    setChoices([]);
    session.current = null;
    latest.current += 1;
  }

  if (blocked) return null;
  return (
    <main className="card chat">
      <div className="field">
        <label htmlFor="live-employee">Fictional employee and company plan</label>
        <select id="live-employee" value={employeeId} onChange={chooseEmployee}>
          <option value="">Choose a demo employee</option>
          {DEMO_EMPLOYEES.map((employee) => <option key={employee.id} value={employee.id}>{employee.label}</option>)}
        </select>
      </div>
      <p className="note">Estimates use fictional policy and usage data. They do not record completed care.</p>
      <div className="chat-scroll">
        <ol className="chat-log" role="log" aria-live="polite" aria-label="Conversation">
          {messages.map((message, index) => (
            <li key={`${index}-${message.from}`} className={`bubble bubble-${message.from}${message.estimate ? ' bubble-wide' : ''}`}>
              {message.text && <p className="bubble-text">{message.text}</p>}
              {message.estimate && <EstimateCard estimate={message.estimate} />}
            </li>
          ))}
        </ol>
        {choices.length > 0 && <div className="chips" role="group" aria-label="Suggested answers">
          {choices.map((choice) => <button className="chip" type="button" key={choice.value} disabled={busy}
            onClick={() => answer(choice.value)}>{choice.label}</button>)}
        </div>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <form className="chat-form" onSubmit={(event) => { event.preventDefault(); answer(draft); }}>
        <label className="visually-hidden" htmlFor="live-chat-input">Your message</label>
        <input id="live-chat-input" type="text" value={draft} onChange={(event) => setDraft(event.target.value)}
          placeholder={employeeId ? 'Ask about your coverage' : 'Choose an employee first'} disabled={!employeeId || busy} />
        <button className="btn chat-send" type="submit" disabled={!employeeId || busy || !draft.trim()}>Send</button>
      </form>
      <p className="actions"><button type="button" className="link" disabled={!employeeId || busy} onClick={() => {
        session.current = null;
        setMessages([]);
        setChoices([]);
        send({ event: 'restart' }, employeeId, null);
      }}>Start a new conversation</button></p>
      <p className="actions"><Link className="link" to={ROUTES.profile}>View benefits and care history</Link>
        {' · '}<button type="button" className="link" disabled={!employeeId} onClick={() => navigate(startUpdate('manual', ROUTES.profile))}>Record recent care</button></p>
    </main>
  );
}
