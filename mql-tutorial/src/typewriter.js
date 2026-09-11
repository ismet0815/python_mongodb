// Small typewriter helpers used both for cinematic narration text and for
// the "watch me type the answer" replay animation.

/**
 * Reveals `text` inside `el` one character at a time.
 * Returns a promise that resolves when done, and can be skipped early by
 * calling the returned `.skip()` method (fills in the rest instantly).
 */
export function typeInto(el, text, { speed = 22, signal } = {}) {
  let cancelled = false;
  el.textContent = "";

  const promise = new Promise((resolve) => {
    let i = 0;
    function step() {
      if (cancelled || signal?.skip) {
        el.textContent = text;
        resolve();
        return;
      }
      if (i >= text.length) {
        resolve();
        return;
      }
      el.textContent += text[i];
      i += 1;
      setTimeout(step, speed);
    }
    step();
  });

  promise.skip = () => {
    cancelled = true;
  };
  return promise;
}

/**
 * Types `text` into a form control's `.value` (textarea/input), so it reads
 * like someone is actually typing the query live.
 */
export function typeIntoField(field, text, { speed = 14 } = {}) {
  return new Promise((resolve) => {
    field.value = "";
    let i = 0;
    function step() {
      if (i >= text.length) {
        resolve();
        return;
      }
      field.value += text[i];
      field.scrollTop = field.scrollHeight;
      i += 1;
      setTimeout(step, speed);
    }
    step();
  });
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
