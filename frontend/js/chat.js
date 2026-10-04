import './firebase.js';
import { createChatSession } from './chat-client.mjs';

const employee = document.getElementById('demo-employee');
const start = document.getElementById('start-chat');
const form = document.getElementById('chat-form');
const input = document.getElementById('chat-text');
const messages = document.getElementById('chat-messages');
const choices = document.getElementById('chat-choices');
const context = document.getElementById('chat-context');
const estimate = document.getElementById('chat-estimate');
const status = document.getElementById('chat-status');
const signInNote = document.getElementById('sign-in-note');

async function send(body) {
  const token = await window.appAuth.idToken();
  if (!token) throw new Error('Sign in to use live chat.');
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(18000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Chat is unavailable. Try again.');
  return data;
}

const chat = createChatSession(send);

function appendMessage(who, text) {
  const item = document.createElement('li');
  const label = document.createElement('strong');
  label.textContent = `${who}: `;
  item.append(label, document.createTextNode(text));
  messages.append(item);
  item.scrollIntoView({ block: 'nearest' });
}

function suggestedReplies(data) {
  if (data.choices?.length) {
    const replies = [...data.choices];
    if (data.conversation_state === 'Estimate') {
      replies.push({ label: 'Review benefits', value: 'review my benefits' });
      replies.push({ label: 'Main menu', value: 'main menu' });
    }
    return replies;
  }
  if (data.conversation_state === 'Menu') return [
    { label: 'Estimate a procedure', value: 'estimate a procedure' },
    { label: 'Review benefits used', value: 'review my benefits' },
    { label: 'Compare dentist networks', value: 'compare dentist networks' },
  ];
  if (data.conversation_state === 'Estimate') return [
    { label: 'Change network', value: 'change network' },
    { label: 'Another procedure', value: 'another procedure' },
    { label: 'Review benefits', value: 'review my benefits' },
    { label: 'Main menu', value: 'main menu' },
  ];
  if (data.conversation_state === 'Benefits') return [
    { label: 'Estimate a procedure', value: 'estimate a procedure' },
    { label: 'Main menu', value: 'main menu' },
  ];
  return [];
}

function render(data) {
  for (const message of data.messages || []) appendMessage('Assistant', message);
  const benefits = data.benefits;
  context.textContent = benefits ? `Demo context: ${benefits.company_name} · ${benefits.plan_name}` : '';
  choices.replaceChildren();
  for (const choice of suggestedReplies(data)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'link-btn';
    button.textContent = choice.label;
    button.addEventListener('click', () => run(() => chat.say(choice.value), choice.label));
    choices.append(button);
  }
  if (data.estimate) {
    const total = data.estimate.totals;
    estimate.textContent = `Approximate estimate: plan pays $${total.plan_pays.toFixed(2)}; you pay $${total.employee_owes.toFixed(2)}. Recorded usage is unchanged.`;
    estimate.hidden = false;
  } else {
    estimate.hidden = true;
  }
}

async function run(action, userText, clearOnSuccess = false) {
  start.disabled = true;
  input.disabled = true;
  choices.querySelectorAll('button').forEach(button => { button.disabled = true; });
  status.hidden = true;
  try {
    const data = await action();
    if (clearOnSuccess) messages.replaceChildren();
    if (userText) appendMessage('You', userText);
    render(data);
    form.hidden = false;
    input.focus();
  } catch (error) {
    status.textContent = error.message || 'Chat is unavailable. Try again.';
    status.hidden = false;
  } finally {
    start.disabled = false;
    input.disabled = false;
    choices.querySelectorAll('button').forEach(button => { button.disabled = false; });
  }
}

start.addEventListener('click', async () => {
  if (chat.sessionId && !window.confirm('Start a new conversation? Your current chat will be cleared.')) return;
  await run(() => chat.start(employee.value), null, true);
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  run(() => chat.say(text), text).then(() => { if (status.hidden) input.value = ''; });
});

window.appAuth.idToken().then(token => {
  signInNote.hidden = Boolean(token);
  start.disabled = !token;
}).catch(() => {
  signInNote.hidden = false;
  start.disabled = true;
});
