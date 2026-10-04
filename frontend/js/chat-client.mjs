export function createChatSession(send) {
  let employeeId = null;
  let sessionId = null;
  let lastResponse = null;
  let busy = false;

  async function request(body) {
    if (busy) throw new Error('A chat request is already in progress.');
    busy = true;
    try {
      const response = await send(body);
      if (!response || typeof response.session_id !== 'string') {
        throw new Error('The chat response did not include a session.');
      }
      employeeId = body.employee_id;
      sessionId = response.session_id;
      lastResponse = response;
      return response;
    } finally {
      busy = false;
    }
  }

  return {
    get employeeId() { return employeeId; },
    get sessionId() { return sessionId; },
    get lastResponse() { return lastResponse; },
    get busy() { return busy; },
    start(selectedEmployee) {
      if (!selectedEmployee) throw new Error('Choose a fictional employee.');
      return request({ employee_id: selectedEmployee, event: 'start' });
    },
    say(text) {
      if (busy) throw new Error('A chat request is already in progress.');
      if (!employeeId || !sessionId) throw new Error('Start a conversation first.');
      if (typeof text !== 'string' || !text.trim()) throw new Error('Enter a message.');
      return request({ employee_id: employeeId, session_id: sessionId, text: text.trim() });
    },
  };
}
