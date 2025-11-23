class UnifiedControls {
  constructor(logger = null) {
    this.logger = logger;

    // Gamepad
    this.pad = new GamepadWrapper(0);

    // Keyboard state
    this.keys = {};
    this.prevKeys = {};

    // Mouse state
    this.mouseDown = false;
    this.prevMouseDown = false;

    // Gamepad button edges
    this.prevButtons = {};
  }

  // ----- Keyboard -----
  keyPressed() {
    this.keys[key] = true;
    this.logEvent(`key_${key}_pressed`);
  }
  keyReleased() {
    this.keys[key] = false;
    this.logEvent(`key_${key}_released`);
  }

  // ----- Mouse -----
  mousePressed() {
    this.mouseDown = true;
    this.logEvent(`mouse_pressed`);
  }
  mouseReleased() {
    this.mouseDown = false;
    this.logEvent(`mouse_released`);
  }

  // ----- Logging helper -----
  logEvent(eventName) {
    if (this.logger) {
      this.logger.log(eventName, window.performance.now());
    }
  }

  // ----- Update per frame -----
  update() {
    this.pad.update();

    // --- keyboard edges
    this.justPressedKeys = {};
    this.justReleasedKeys = {};
    for (let k in this.keys) {
      const now = this.keys[k];
      const prev = this.prevKeys[k] || false;
      this.justPressedKeys[k] = now && !prev;
      this.justReleasedKeys[k] = !now && prev;
    }
    this.prevKeys = { ...this.keys };

    // --- mouse edges
    this.justPressedMouse = this.mouseDown && !this.prevMouseDown;
    this.justReleasedMouse = !this.mouseDown && this.prevMouseDown;
    this.prevMouseDown = this.mouseDown;

    // --- gamepad edges
    const curButtons = {};
    for (const name of Object.keys(this.pad.buttonMap)) {
      curButtons[name] = this.pad.pressed(name);
    }
    this.justPressedButtons = {};
    this.justReleasedButtons = {};
    for (const name in curButtons) {
      const now = curButtons[name];
      const prev = this.prevButtons[name] || false;
      this.justPressedButtons[name] = now && !prev;
      this.justReleasedButtons[name] = !now && prev;

      // log edges
      if (this.justPressedButtons[name]) this.logEvent(`gp_${name}_pressed`);
      if (this.justReleasedButtons[name]) this.logEvent(`gp_${name}_released`);
    }
    this.prevButtons = curButtons;
  }

  // ----- Helpers -----
  isKey(k) { return !!this.keys[k]; }
  justPressedKey(k) { return !!this.justPressedKeys[k]; }
  justReleasedKey(k) { return !!this.justReleasedKeys[k]; }

  isMouseDown() { return this.mouseDown; }
  justPressedMouse() { return this.justPressedMouse; }
  justReleasedMouse() { return this.justReleasedMouse; }

  pressedButton(name) { return this.pad.pressed(name); }
  justPressedButton(name) { return !!this.justPressedButtons[name]; }
  justReleasedButton(name) { return !!this.justReleasedButtons[name]; }

  leftStick() { return this.pad.leftStick(); }
  dpad() { return this.pad.dpad; }
}
