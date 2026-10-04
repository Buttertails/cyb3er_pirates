export function botMessagesFromReply(result) {
  return [
    ...(result.messages || []).map((text) => ({ from: 'bot', text })),
    ...(result.estimate ? [{ from: 'bot', estimate: result.estimate }] : []),
    ...(result.dentists ? [{ from: 'bot', dentists: result.dentists }] : []),
  ];
}
