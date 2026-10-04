import { expect, it } from 'vitest';
import { botMessagesFromReply } from './chatMessages.js';

it('puts a dentist directory card after the assistant text', () => {
  const directory = { status: 'ok', message: 'Sample offices', offices: [{ id: 'cary-c0' }] };
  expect(botMessagesFromReply({ messages: ['Here are your options.'],
    estimate: null, dentists: directory })).toEqual([
    { from: 'bot', text: 'Here are your options.' },
    { from: 'bot', dentists: directory },
  ]);
});

it('keeps an ordinary estimate turn free of dentist cards', () => {
  const estimate = { totals: { employee_owes: 40 } };
  expect(botMessagesFromReply({ messages: ['Your estimate'], estimate, dentists: null })).toEqual([
    { from: 'bot', text: 'Your estimate' },
    { from: 'bot', estimate },
  ]);
});
