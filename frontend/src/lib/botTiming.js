export async function waitForBotReply() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  await new Promise((resolve) => { window.setTimeout(resolve, 1000); });
}
