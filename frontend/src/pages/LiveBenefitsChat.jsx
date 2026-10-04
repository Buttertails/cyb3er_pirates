import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DentistResults, EstimateCard, LincolnLoader, useDocumentTitle, useFlowGuard } from '../components.jsx';
import { saveSavedPlan, sendLiveChat, SignedOutError, submitErrorMessage, uploadProcedurePdf } from '../lib/api.js';
import { signOut } from '../lib/auth.js';
import { waitForBotReply } from '../lib/botTiming.js';
import { botMessagesFromReply } from '../lib/chatMessages.js';
import { employeeIdForCompany } from '../lib/demoEmployees.js';
import { shouldStartLiveSession } from '../lib/liveChatState.js';
import { readStep, ROUTES, saveStep } from '../lib/storage.js';

// A "Save this estimate" control shown under each estimate in the live chat,
// so the user can keep it on their profile. Keyed by the same employee the
// profile reads from.
function SaveEstimateButton({ estimate, employeeId }) {
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  async function save() {
    if (state === 'saving' || state === 'saved') return;
    setState('saving');
    try {
      await saveSavedPlan({
        employeeId,
        kind: 'estimate',
        result: estimate,
        label: estimate?.lines?.[0]?.label,
      });
      setState('saved');
    } catch {
      setState('error');
    }
  }
  if (state === 'saved') return <p className="saved-confirm" role="status">Saved to your profile.</p>;
  return (
    <p className="estimate-save">
      <button type="button" className="link-btn" onClick={save} disabled={state === 'saving' || !employeeId}>
        {state === 'saving' ? 'Saving…' : 'Save this estimate'}
      </button>
      {state === 'error' && <span className="error"> Couldn’t save. Try again.</span>}
    </p>
  );
}

const RESTART = /^(start over|restart|reset|start again)[.!]?$/i;

export function LiveBenefitsChat({ chatSession, setChatSession }) {
  useDocumentTitle('Dental benefits assistant');
  const { blocked } = useFlowGuard([]);
  const navigate = useNavigate();
  const employeeId = readStep('demo_employee_id') || employeeIdForCompany(readStep('company'));
  const messages = chatSession.messages;
  const choices = chatSession.choices;
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const session = useRef(chatSession.sessionId);
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
      setChatSession((previous) => ({ ...previous, initialized: true, sessionId: result.session_id,
        messages: previous.messages.concat(botMessagesFromReply(result)), choices: result.choices || [] }));
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

  async function upload(file) {
    if (!file || !employeeId || busy) return;
    const requestId = ++latest.current;
    setBusy(true);
    setError('');
    try {
      const result = await uploadProcedurePdf(file, employeeId, session.current);
      if (requestId !== latest.current) return;
      session.current = result.session_id;
      await waitForBotReply();
      if (requestId !== latest.current) return;
      const preview = `Uploaded ${result.document.filename}\nText used: ${result.document.excerpt}`;
      setChatSession((previous) => ({ ...previous, initialized: true, sessionId: result.session_id,
        messages: previous.messages.concat({ from: 'user', text: preview }, botMessagesFromReply(result)),
        choices: result.choices || [] }));
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
    if (shouldStartLiveSession(chatSession)) {
      session.current = null;
      send({ event: 'start' }, employeeId, null);
    }
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
      setChatSession((previous) => ({ ...previous, initialized: false, sessionId: null,
        messages: [], choices: [] }));
      setDraft('');
      send({ event: 'restart' }, employeeId, null);
      return;
    }
    setChatSession((previous) => ({ ...previous, messages: previous.messages.concat({ from: 'user', text }), choices: [] }));
    setDraft('');
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
              {message.estimate && <SaveEstimateButton estimate={message.estimate} employeeId={employeeId} />}
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
        <label className="chat-upload" title="Upload procedure PDF">
          <span aria-hidden="true">＋</span><span className="visually-hidden">Upload procedure PDF</span>
          <input type="file" accept="application/pdf,.pdf" disabled={busy}
            onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; upload(file); }} />
        </label>
        <label className="visually-hidden" htmlFor="live-chat-input">Your message</label>
        <input id="live-chat-input" type="text" value={draft} onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about your coverage" disabled={busy} />
        <button className="btn chat-send" type="submit" disabled={busy || !draft.trim()}>Send</button>
      </form>
    </main>
  );
}
