import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EstimateCard, useDocumentTitle, useFlowGuard } from '../components.jsx';
import { SignedOutError, submitErrorMessage } from '../lib/api.js';
import { signOut } from '../lib/auth.js';
import { firstStep, greeting, STEPS } from '../lib/chatScript.js';
import {
  clearAnswers,
  readStep,
  ROUTES,
  saveStep,
} from '../lib/storage.js';

const TYPING_MS = 450;
const RESTART = /^(start over|restart|reset|start again)[.!]?$/i;

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pause(ms) {
  return new Promise((resolve) => { window.setTimeout(resolve, ms); });
}

function messageId() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// The buttons under a question: a step's short list of suggestions when it has
// one, otherwise every choice it accepts.
function buttonsFor(step) {
  return { choices: step?.suggestions?.() || step?.choices?.() || [], details: Boolean(step?.details) };
}

export function ChatPage() {
  useDocumentTitle('Dental assistant');
  const { blocked } = useFlowGuard([]);
  const navigate = useNavigate();
  const [log, setLog] = useState(() => readStep('chat_log') || []);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const logRef = useRef(log);
  const nodeRef = useRef(readStep('chat_node'));
  const startedRef = useRef(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const typedRef = useRef(true);

  function setMessages(messages) {
    logRef.current = messages;
    setLog(messages);
    saveStep('chat_log', messages);
  }

  function append(message) {
    setMessages(logRef.current.concat({ id: messageId(), ...message }));
  }

  async function botSay(messages) {
    for (const message of messages) {
      if (!reducedMotion()) {
        setTyping(true);
        await pause(TYPING_MS);
        setTyping(false);
      }
      append({ from: 'bot', ...message });
    }
  }

  async function ask(stepId, replies = []) {
    const step = STEPS[stepId];
    nodeRef.current = stepId;
    saveStep('chat_node', stepId);
    const asked = await step.ask();
    const question = asked.at(-1);
    asked[asked.length - 1] = {
      ...buttonsFor(step),
      ...question,
      input: step.input,
    };
    await botSay(replies.map((text) => ({ text })).concat(asked));
  }

  async function reAsk(text) {
    const step = STEPS[nodeRef.current];
    await botSay([{ text, ...buttonsFor(step), input: step?.input }]);
  }

  async function restart() {
    clearAnswers();
    nodeRef.current = null;
    setMessages([]);
    await botSay([{ text: 'Okay, let’s start fresh.' }]);
    await ask(firstStep());
  }

  async function run(work) {
    setBusy(true);
    try {
      await work();
    } catch (cause) {
      setTyping(false);
      if (cause instanceof SignedOutError) {
        await signOut();
        navigate(`${ROUTES.signIn}?signed-out=1`);
        return;
      }
      await reAsk(submitErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function respond({ text = '', choiceId, label }) {
    const shown = (label || text).trim();
    if (busy || !shown) return;
    typedRef.current = !choiceId;
    append({ from: 'user', text: shown });
    setDraft('');
    run(async () => {
      if (!choiceId && RESTART.test(shown)) {
        await restart();
        return;
      }
      const result = await STEPS[nodeRef.current].answer({ text, choiceId });
      if (result.error) {
        await reAsk(result.error);
      } else if (result.restart) {
        await restart();
      } else if (result.navigate) {
        // The next visit to the chat picks up wherever the answers left off.
        nodeRef.current = null;
        saveStep('chat_node', null);
        navigate(result.navigate);
      } else {
        await ask(result.next, result.replies);
      }
    });
  }

  useEffect(() => {
    if (blocked || startedRef.current) return;
    startedRef.current = true;
    const last = logRef.current.at(-1);
    if (nodeRef.current && STEPS[nodeRef.current] && last?.from === 'bot') return;
    run(async () => {
      if (logRef.current.length === 0) await botSay([{ text: greeting() }]);
      await ask(STEPS[nodeRef.current] ? nodeRef.current : firstStep());
    });
  }, [blocked]);

  // Hand focus back to the text box after a typed answer. After a chip tap it
  // stays put, so phones don't pop the keyboard open for every question.
  useEffect(() => {
    if (!busy && typedRef.current) inputRef.current?.focus();
  }, [busy]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [log, typing]);

  if (blocked) return null;
  const last = log.at(-1);
  const choices = last?.from === 'bot' && !busy ? last.choices || [] : [];
  const describe = Boolean(last?.details);

  function submit(event) {
    event.preventDefault();
    respond({ text: draft });
  }

  return (
    <main className="card chat">
      <div className="chat-scroll" ref={scrollRef}>
        <ol className="chat-log" role="log" aria-live="polite" aria-label="Conversation">
          {log.map((message) => (
            <li
              key={message.id}
              className={`bubble bubble-${message.from}${message.kind === 'estimate' ? ' bubble-wide' : ''}`}
            >
              <span className="visually-hidden">{message.from === 'bot' ? 'Assistant: ' : 'You: '}</span>
              {message.text && <p className="bubble-text">{message.text}</p>}
              {message.kind === 'estimate' && <EstimateCard estimate={message.data} />}
            </li>
          ))}
          {typing && (
            <li className="bubble bubble-bot typing" aria-label="Assistant is typing">
              <span /><span /><span />
            </li>
          )}
        </ol>
        {choices.length > 0 && (
          <div className="chips" role="group" aria-label="Suggested answers">
            {choices.map((choice) => (
              <button
                type="button"
                className="chip"
                key={choice.id}
                onClick={() => respond({ text: choice.label, choiceId: choice.id, label: choice.label })}
              >
                <span className="chip-label">{choice.label}</span>
                {describe && choice.description && <span className="chip-desc">{choice.description}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="chat-input">Your answer</label>
        <input
          id="chat-input"
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={last?.input?.placeholder || 'Type your answer'}
          inputMode={last?.input?.inputMode}
          autoComplete="off"
          disabled={busy}
        />
        <button className="btn chat-send" type="submit" disabled={busy || !draft.trim()}>Send</button>
      </form>
    </main>
  );
}
