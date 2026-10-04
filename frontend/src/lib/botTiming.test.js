import { afterEach, expect, it, vi } from 'vitest';
import { waitForBotReply } from './botTiming.js';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('keeps a bot reply hidden for about one second', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: false }),
    setTimeout,
  });
  let visible = false;
  const reveal = waitForBotReply().then(() => { visible = true; });

  await vi.advanceTimersByTimeAsync(999);
  expect(visible).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await reveal;
  expect(visible).toBe(true);
});

it('reveals a bot reply immediately when reduced motion is preferred', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: true }),
    setTimeout,
  });

  await waitForBotReply();
  expect(vi.getTimerCount()).toBe(0);
});
