import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatSession } from '../js/chat-client.mjs';

test('starts with an explicitly selected fictional employee and keeps its session', async () => {
  const sent = [];
  const chat = createChatSession(async body => {
    sent.push(body);
    return { session_id: 'signed-reference', conversation_state: 'Menu', messages: ['Choose an option'], choices: [] };
  });
  await chat.start('demo-a-pat');
  await chat.say('estimate a procedure');
  assert.deepEqual(sent, [
    { employee_id: 'demo-a-pat', event: 'start' },
    { employee_id: 'demo-a-pat', session_id: 'signed-reference', text: 'estimate a procedure' },
  ]);
});

test('switching fictional employee starts a separate session', async () => {
  const sent = [];
  let n = 0;
  const chat = createChatSession(async body => {
    sent.push(body);
    return { session_id: `session-${++n}`, messages: [], choices: [] };
  });
  await chat.start('demo-a-pat');
  await chat.start('demo-c-lee');
  assert.deepEqual(sent[1], { employee_id: 'demo-c-lee', event: 'start' });
  assert.equal(chat.employeeId, 'demo-c-lee');
  assert.equal(chat.sessionId, 'session-2');
});

test('failed request retains the previous valid session and response for retry', async () => {
  let fail = false;
  const chat = createChatSession(async () => {
    if (fail) throw Error('temporary failure');
    return { session_id: 'session-1', messages: ['Previous result'], choices: [] };
  });
  await chat.start('demo-a-pat');
  fail = true;
  await assert.rejects(chat.say('filling'), /temporary failure/);
  assert.equal(chat.sessionId, 'session-1');
  assert.deepEqual(chat.lastResponse.messages, ['Previous result']);
});

test('concurrent sends cannot replace the current conversation', async () => {
  let finish;
  const chat = createChatSession(() => new Promise(resolve => { finish = resolve; }));
  const first = chat.start('demo-a-pat');
  assert.throws(() => chat.say('filling'), /already in progress/);
  finish({ session_id: 'session-1', messages: [], choices: [] });
  await first;
  assert.equal(chat.sessionId, 'session-1');
});
