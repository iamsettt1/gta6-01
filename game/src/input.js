// Keyboard and mouse state for Solmar Bay. The game reads held keys each
// frame and consumes edge-triggered presses (E, R, P, J, M, Enter, click) so
// one press never fires twice.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicked = false;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
      this.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.clicked = true;
      }
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
  }

  held(key) {
    return this.keys.has(key);
  }

  // True once, on the frame the key went down; main.js clears it each frame.
  wasPressed(key) {
    return this.pressed.has(key);
  }

  consume(key) {
    this.pressed.delete(key);
  }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }

  // Movement keys as -1/0/1, accepting WASD and the arrow keys.
  moveX() {
    return (this.held('d') || this.held('arrowright') ? 1 : 0) - (this.held('a') || this.held('arrowleft') ? 1 : 0);
  }

  moveY() {
    return (this.held('s') || this.held('arrowdown') ? 1 : 0) - (this.held('w') || this.held('arrowup') ? 1 : 0);
  }
}
