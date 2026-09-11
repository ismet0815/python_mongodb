// Countdown timer for a challenge. Ticks once per second and reports back
// through callbacks so the UI can render a shrinking progress bar.

export function createCountdown(totalSeconds, { onTick, onExpire }) {
  let remaining = totalSeconds;
  let intervalId = null;
  let stopped = false;

  function tick() {
    if (stopped) return;
    onTick(remaining, totalSeconds);
    if (remaining <= 0) {
      stop();
      onExpire();
      return;
    }
    remaining -= 1;
  }

  return {
    start() {
      tick();
      intervalId = setInterval(tick, 1000);
    },
    stop,
    get remaining() {
      return remaining;
    },
  };

  function stop() {
    stopped = true;
    if (intervalId) clearInterval(intervalId);
  }
}
