import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DentistResults, EstimateCard, LincolnLoader, useDocumentTitle, useFlowGuard } from '../components.jsx';
import { sendLiveChat, SignedOutError, submitErrorMessage } from '../lib/api.js';
import { signOut } from '../lib/auth.js';
import { waitForBotReply } from '../lib/botTiming.js';
import { botMessagesFromReply } from '../lib/chatMessages.js';
import { employeeIdForCompany } from '../lib/demoEmployees.js';
import { readStep, ROUTES, saveStep } from '../lib/storage.js';

const RESTART = /^(start over|restart|reset|start again)[.!]?$/i;

export function LiveBenefitsChat() {
  useDocumentTitle('Dental benefits assistant');
  const { blocked } = useFlowGuard([]);
  const navigate = useNavigate();
  const employeeId = readStep('demo_employee_id') || employeeIdForCompany(readStep('company'));
  const [messages, setMessages] = useState([]);
  const [choices, setChoices] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const session = useRef(null);
  const latest = useRef(0);
  const scrollRef = useRef(null);

  async function send(message, selected = employeeId, current = session.current) {
    const requestId = ++latest.current;
    setBusy(true);
    setError('');
    try {
      const result = await sendLiveChat(selected, current, message);
      if (requestId !== latest.current) return;
      session.current = result.session_id;
      await waitForBotReply();
      if (requestId !== latest.current) return;
      setMessages((previous) => previous.concat(botMessagesFromReply(result)));
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
    saveStep('demo_employee_id', employeeId);
    setMessages([]);
    setChoices([]);
    session.current = null;
    send({ event: 'start' }, employeeId, null);
    return () => { latest.current += 1; };
  }, [blocked, employeeId]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages, busy]);

  function answer(value) {
    const text = value.trim();
    if (!employeeId || !text || busy) return;
    if (RESTART.test(text)) {
      session.current = null;
      setMessages([]);
      setChoices([]);
      setDraft('');
      send({ event: 'restart' }, employeeId, null);
      return;
    }
    setMessages((previous) => previous.concat({ from: 'user', text }));
    setDraft('');
    setChoices([]);
    send({ text });
  }

  if (blocked) return null;
  return (
    <main className="card chat">
      <div className="chat-scroll" ref={scrollRef}>
        <ol className="chat-log" role="log" aria-live="polite" aria-label="Conversation">
          {messages.map((message, index) => (
            <li key={`${index}-${message.from}`} className={`bubble bubble-${message.from}${message.estimate || message.dentists ? ' bubble-wide' : ''}`}>
              {message.text && <p className="bubble-text">{message.text}</p>}
              {message.estimate && <EstimateCard estimate={message.estimate} />}
              {message.dentists && <DentistResults result={message.dentists} />}
            </li>
          ))}
          {busy && (
            <li className="bubble bubble-bot bubble-loader" aria-label="Assistant is thinking">
              <LincolnLoader />
            </li>
          )}
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
          placeholder="Ask about your coverage" disabled={busy} />
        <button className="btn chat-send" type="submit" disabled={busy || !draft.trim()}>Send</button>
      </form>
    </main>
  );
}
