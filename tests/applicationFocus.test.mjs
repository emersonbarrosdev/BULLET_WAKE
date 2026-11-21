import assert from 'node:assert/strict';
import test from 'node:test';
import { watchApplicationFocus } from '../src/game/audio/ApplicationFocus.ts';

test('tab, minimize and native focus events silence once and clean up listeners', () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  const win = new EventTarget(), doc = new EventTarget();
  let focused = true; doc.hidden = false; doc.hasFocus = () => focused;
  globalThis.window = win; globalThis.document = doc;
  try {
    const states = [], dispose = watchApplicationFocus(active => states.push(active));
    win.dispatchEvent(new Event('blur')); doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    win.dispatchEvent(new Event('focus')); // Hidden app cannot restart music.
    assert.deepEqual(states, [true, false]);
    doc.hidden = false; focused = false; doc.dispatchEvent(new Event('visibilitychange'));
    assert.deepEqual(states, [true, false]);
    focused = true; win.dispatchEvent(new Event('focus')); win.dispatchEvent(new Event('pagehide'));
    win.dispatchEvent(new Event('pageshow'));
    assert.deepEqual(states, [true, false, true, false, true]);
    dispose(); win.dispatchEvent(new Event('blur')); doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(states.length, 5);
  } finally { globalThis.window = oldWindow; globalThis.document = oldDocument; }
});
