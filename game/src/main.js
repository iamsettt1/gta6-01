// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between title, play, paused, missions,
// busted and wasted screens. Progress (cash, finished missions, best cash) is
// saved to localStorage, and the live game state is exposed on window.__game so
// a play-test can read it.
//
// ?seed=N fixes the city and traffic. ?shot=start|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_HIT, EVENT_MISSION, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_STEAL, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MISSIONS, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_RELOAD, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_MISSIONS, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';
import { MISSIONS } from './missions.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best cash then lasts this visit only.
  }
}

let save = readSave() || { cash: 250, completed: [], bestCash: 0, stats: null };
world.applySave(save);
let best = Math.max(readBest(), save.bestCash || 0);

function persist() {
  const s = world.getSave();
  save = { cash: s.cash, completed: s.completed, bestCash: Math.max(best, s.cash), stats: s.stats };
  writeSave(save);
  if (s.cash > best) {
    best = s.cash;
    saveBest(best);
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, save);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  // The game state is visible to the screenshot harness for verification.
  window.__game = { world: world.state, screen: scene.screen, save };
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let muted = false;
  let persistTimer = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startFreeRoam() {
    world.reset();
    world.applySave(save);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing Solmar Bay. Press J for missions.');
  }

  function toTitle() {
    screen = SCREEN_TITLE;
    announce('Solmar Bay. Press Enter or click to start.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.gunshot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_MISSION) {
      audio.missionDone();
      persist();
    }
    if (events & EVENT_STEAL) audio.crash();
    if (events & EVENT_BUSTED) {
      audio.busted();
      const fine = Math.min(200, world.state.cash);
      world.state.cash -= fine;
      world.state.fine = fine;
      world.failMission('the PD made the arrest');
      screen = SCREEN_BUSTED;
      persist();
      announce('Busted. The Solmar Bay PD took Milo in.');
    }
    if (events & EVENT_WASTED) {
      audio.busted();
      world.failMission('Milo went down');
      screen = SCREEN_WASTED;
      persist();
      announce('Wasted. Milo went down in Solmar Bay.');
    }
    if (events & EVENT_HIT) audio.crash();
  }

  function aimAngle() {
    const mouse = input.mouse();
    const logical = renderer.toLogical(mouse.x, mouse.y);
    const p = world.state.player;
    // Aim from the player's on-screen position toward the mouse.
    const sp = renderer.toScreen(p.x, p.y);
    const dx = logical.x - sp.x;
    const dy = logical.y - sp.y;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return p.aimAngle;
    return Math.atan2(dy, dx);
  }

  function stepGame() {
    const mouse = input.mouse();
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM || mouse.clicked) {
        audio.unlock();
        startFreeRoam();
      }
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM || mouse.clicked) {
        audio.unlock();
        startFreeRoam();
      }
      return;
    }
    if (screen === SCREEN_MISSIONS) {
      if (actions & ACTION_MISSIONS || actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        return;
      }
      if (mouse.clicked) {
        const logical = renderer.toLogical(mouse.x, mouse.y);
        const id = renderer.missionAt(logical.x, logical.y);
        if (id) {
          const m = MISSIONS.find((x) => x.id === id);
          world.startMission(id);
          screen = SCREEN_PLAY;
          announce(`Mission started: ${m.title}.`);
        }
      }
      // Number keys 1-6 start a mission directly.
      const digit = input.takeDigit();
      if (digit >= 1 && digit <= MISSIONS.length) {
        const m = MISSIONS[digit - 1];
        const completed = save.completed || [];
        const available = completed.includes(m.id) || digit === 1 || completed.includes(MISSIONS[digit - 2].id);
        if (available) {
          world.startMission(m.id);
          screen = SCREEN_PLAY;
          announce(`Mission started: ${m.title}.`);
        }
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_MISSIONS) {
        screen = SCREEN_MISSIONS;
      } else if (actions & ACTION_CONFIRM) {
        startFreeRoam();
      }
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (actions & ACTION_MISSIONS) {
      screen = SCREEN_MISSIONS;
      return;
    }
    const stepInput = {
      mx: input.moveX(),
      my: input.moveY(),
      run: input.running(),
      handbrake: input.handbrake(),
      interact: !!(actions & ACTION_INTERACT),
      punch: !!(actions & ACTION_PUNCH),
      shoot: mouse.down,
      reload: !!(actions & ACTION_RELOAD),
      aimAngle: aimAngle(),
    };
    if (mouse.down || stepInput.interact) audio.unlock();
    const events = world.step(STEP, stepInput, false);
    handleEvents(events);
    audio.engine(world.state.player.inCar ? Math.abs(world.state.player.inCar.speed) / 560 : 0, !!world.state.player.inCar);
    audio.siren(world.state.stars > 0);
    persistTimer += STEP;
    if (persistTimer > 5) {
      persistTimer = 0;
      persist();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === SCREEN_TITLE) {
      // The title screen lives over a slow, harmless city.
      while (accumulator >= STEP) {
        world.step(STEP, { mx: 0, my: 0, run: false, handbrake: false, interact: false, punch: false, shoot: false, reload: false, aimAngle: 0 }, true);
        accumulator -= STEP;
      }
      const mouse = input.mouse();
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM || mouse.clicked) {
        audio.unlock();
        startFreeRoam();
      }
      if (actions & ACTION_MUTE) {
        muted = !muted;
        audio.setMuted(muted);
      }
    } else {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepGame();
        accumulator -= STEP;
      }
      if (screen !== SCREEN_PLAY) {
        stepGame();
        accumulator = 0;
      }
    }
    input.clearClick();
    renderer.draw(world.state, screen, save);
  }

  // Leaving the tab pauses a running game rather than letting the police close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // The game state is visible to the play-test harness for verification.
  window.__game = {
    get world() {
      return world.state;
    },
    get screen() {
      return screen;
    },
    get save() {
      return save;
    },
    startMission: (id) => {
      if (world.startMission(id)) screen = SCREEN_PLAY;
    },
    start: startFreeRoam,
  };
  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
