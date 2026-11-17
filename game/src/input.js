// Keyboard and mouse input. Held keys give movement and driving; one-shot presses
// (confirm, pause, interact, punch, reload, mute, mission menu) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost
// and never counted twice. The mouse position is kept in screen pixels and the
// loop converts it to world space through the camera.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_MUTE = 32;
export const ACTION_MISSIONS = 64;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let digit = 0;

  function press(code) {
    if (code === 'KeyE' || code === 'Enter') actions |= ACTION_INTERACT | ACTION_CONFIRM;
    else if (code === 'KeyF') actions |= ACTION_PUNCH;
    else if (code === 'KeyR') actions |= ACTION_RELOAD;
    else if (code === 'KeyM') actions |= ACTION_MUTE;
    else if (code === 'KeyJ') actions |= ACTION_MISSIONS;
    else if (code === 'Space') actions |= ACTION_CONFIRM;
    else if (code === 'KeyP' || code === 'Escape') actions |= ACTION_PAUSE;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) event.preventDefault();
      return;
    }
    keys.add(event.code);
    press(event.code);
    if (/^Digit[1-9]$/.test(event.code)) digit = Number(event.code.slice(5));
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || event.code === 'Space') {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
      const rect = canvas.getBoundingClientRect();
      mouseX = event.clientX - rect.left;
      mouseY = event.clientY - rect.top;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    moveX() {
      return (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    },
    moveY() {
      return (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    },
    running() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    handbrake() {
      return keys.has('Space');
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked };
    },
    clearClick() {
      mouseClicked = false;
    },
    /** A number key 1-9 pressed since the last call (0 when none). */
    takeDigit() {
      const d = digit;
      digit = 0;
      return d;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Synthetic input for the screenshot autopilot: set held keys directly. */
    setKeys(list) {
      keys.clear();
      for (const code of list) keys.add(code);
    },
  };
}
