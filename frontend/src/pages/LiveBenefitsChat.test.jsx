import { describe, expect, it } from 'vitest';
import { chatSessionForUser, shouldStartLiveSession } from '../lib/liveChatState.js';

describe('live chat continuity', () => {
  it('retains an open conversation when the same user returns from Account', () => {
    const current = {
      user: 'pat@example.com', initialized: true, sessionId: 'session-1',
      messages: [{ from: 'bot', text: 'Welcome back' }], choices: [],
    };
    const restored = chatSessionForUser(current, 'pat@example.com');
    expect(restored).toBe(current);
    expect(shouldStartLiveSession(restored)).toBe(false);
  });

  it('starts a fresh conversation after the signed-in account changes', () => {
    const old = { user: 'pat@example.com', initialized: true, sessionId: 'session-1',
      messages: [{ from: 'bot', text: 'Private' }], choices: [] };
    const next = chatSessionForUser(old, 'sam@example.com');
    expect(next.messages).toEqual([]);
    expect(next.sessionId).toBeNull();
    expect(shouldStartLiveSession(next)).toBe(true);
  });
});
