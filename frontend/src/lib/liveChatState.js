export function chatSessionForUser(current, user) {
  if (current?.user === user) return current;
  return { user, initialized: false, sessionId: null, messages: [], choices: [] };
}

export function shouldStartLiveSession(session) {
  return !session?.initialized;
}
