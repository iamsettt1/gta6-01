// Solmar Bay — boot, the game loop, screens, save/load and the hooks the
// outside world uses: window.__game for verification and window.__shotReady
// for the deterministic screenshot scenes.

import { VIEW_W, VIEW_H, SAVE_KEY } from './config.js';
import { seedFromString } from './random.js';
import { createWorld, update, respawn } from './world.js';
import { startMission } from './missions.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import {
  drawWorld, drawHUD, drawTitle, drawPause, drawBusted, drawWasted,
  drawMissionsMenu, cameraFor,
} from './render.js';
import { setupShot, autopilotInput } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = params.get('seed');
const seed = seedParam ? seedFromString(`solmar-${seedParam}`) : (Math.floor(Math.random() * 1e9) + 1);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const world = createWorld(seed);
const input = new Input(canvas);
const sound = new SoundEngine();
window.__game = world;
window.__shotReady = false;

let paints = 0;
let lastSave = 0;

// --- Save / load: cash, mission progress, best stats and play time. ---
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const save = JSON.parse(raw);
    if (typeof save.cash === 'number') world.cash = save.cash;
    if (typeof save.missionsDone === 'number') world.stats.missionsDone = save.missionsDone;
    if (typeof save.playSeconds === 'number') world.stats.playSeconds = save.playSeconds;
  } catch {
    // A corrupt save is ignored; the game starts fresh.
  }
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.floor(world.cash),
      missionsDone: world.stats.missionsDone,
      playSeconds: Math.floor(world.stats.playSeconds),
      savedAt: Date.now(),
    }));
  } catch {
    // Storage may be unavailable; the game still plays.
  }
}

world.onMissionComplete = (w, def) => {
  sound.playEvent('jingle');
  saveGame();
};

if (shot) {
  setupShot(world, shot, seedParam ? parseInt(seedParam, 10) : 1);
} else {
  loadSave();
  if (world.stats.missionsDone === 0) {
    world.pendingMission = 0;
    world.nextMissionAt = 0.5;
  } else if (world.stats.missionsDone < 6) {
    world.pendingMission = world.stats.missionsDone;
    world.nextMissionAt = 0.5;
  }
}

function buildInput() {
  const cam = cameraFor(world);
  const mx = input.moveX();
  const my = input.moveY();
  return {
    up: my < 0,
    down: my > 0,
    left: mx < 0,
    right: mx > 0,
    handbrake: input.held(' '),
    enter: input.wasPressed('e'),
    // A quick click can fall between two frames, so the mousedown edge counts
    // as a shot as well as the held button.
    shoot: input.mouseDown || input.clicked,
    reload: input.wasPressed('r'),
    aimX: input.mouseX + cam.x,
    aimY: input.mouseY + cam.y,
  };
}

function startPlaying() {
  sound.ensure();
  if (world.mode === 'title') {
    world.mode = 'play';
    if (!world.mission && world.stats.missionsDone === 0) {
      startMission(world, 0);
    }
  }
}

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  // Off-play screens still animate (the title blink, the menu backdrop).
  if (world.mode !== 'play') world.time += dt;

  // Global keys.
  if (input.wasPressed('m')) {
    sound.ensure();
    sound.setMuted(!sound.muted);
  }

  if (world.mode === 'title') {
    if (input.wasPressed('enter') || input.clicked) startPlaying();
  } else if (world.mode === 'play') {
    if (input.wasPressed('p') || input.wasPressed('escape')) {
      world.mode = 'pause';
    } else if (input.wasPressed('j')) {
      world.mode = 'missions';
    } else {
      const frameInput = shot ? autopilotInput(world) : buildInput();
      update(world, frameInput, dt);
      // Sounds follow the live state.
      const p = world.player;
      const car = p.inCar ? world.cars.find((c) => c.id === p.carId) : null;
      sound.setEngine(car ? Math.abs(car.speed) / 560 : 0, !!car);
      sound.setSiren(world.wanted >= 2 && world.policeCars.some((c) => !c.wrecked));
      if (world.audioEvent) {
        sound.playEvent(world.audioEvent);
        world.audioEvent = null;
      }
      if (world.time - lastSave > 10) {
        lastSave = world.time;
        saveGame();
      }
    }
  } else if (world.mode === 'pause') {
    if (input.wasPressed('p') || input.wasPressed('escape')) world.mode = 'play';
  } else if (world.mode === 'missions') {
    if (input.wasPressed('j') || input.wasPressed('escape')) world.mode = 'play';
  } else if (world.mode === 'busted' || world.mode === 'wasted') {
    if (input.wasPressed('enter') || input.clicked) {
      const kind = world.mode;
      respawn(world, kind);
      saveGame();
    }
  }

  // --- Paint ---
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (world.mode === 'title') {
    drawTitle(ctx, world);
  } else {
    drawWorld(ctx, world, world.time);
    drawHUD(ctx, world, input);
    if (world.mode === 'pause') drawPause(ctx, world);
    else if (world.mode === 'busted') drawBusted(ctx, world);
    else if (world.mode === 'wasted') drawWasted(ctx, world);
    else if (world.mode === 'missions') drawMissionsMenu(ctx, world);
  }
  paints += 1;

  // The screenshot scenes are ready after two paints of the staged world.
  if (shot && paints >= 2 && !window.__shotReady) {
    window.__shotReady = true;
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

window.addEventListener('beforeunload', saveGame);
requestAnimationFrame(frame);
