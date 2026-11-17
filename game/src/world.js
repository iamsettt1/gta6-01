// Solmar Bay's rules and state, with no drawing and no browser in it: the player
// on foot and in cars, traffic, pedestrians, police, the wanted level, combat,
// missions and the clock. step() advances one fixed step and returns what happened
// as bit flags, so the caller can react (sounds, screens) without the world
// knowing about them.
import { CAR, CLOCK, CRIME_HEAT, PLAYER, POLICE, TRAFFIC, WORLD } from './config.js';
import { createCity } from './city.js';
import { MISSIONS, missionById, nextMission } from './missions.js';

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_CRASH = 4;
export const EVENT_PICKUP = 8;
export const EVENT_CASH = 16;
export const EVENT_MISSION = 32;
export const EVENT_BUSTED = 64;
export const EVENT_WASTED = 128;
export const EVENT_STEAL = 256;
export const EVENT_HIT = 512;

const CAR_MODELS = [
  { name: 'Pinto', color: '#c94f3d', kind: 'sedan', speed: 0.9 },
  { name: 'Comet GT', color: '#d9a521', kind: 'sport', speed: 1.15 },
  { name: 'Bison', color: '#4a6a8a', kind: 'truck', speed: 0.8 },
  { name: 'Cab', color: '#e8c832', kind: 'taxi', speed: 0.95 },
  { name: 'Hatch', color: '#6a8a5a', kind: 'sedan', speed: 0.9 },
  { name: 'Vela', color: '#8a5a9a', kind: 'sedan', speed: 1.0 },
  { name: 'Dune', color: '#c97e4a', kind: 'sport', speed: 1.1 },
];
const PED_SHIRTS = ['#e8e8e8', '#d94f6a', '#4f8ad9', '#e8b84f', '#6ad94f', '#9a6ad9', '#d97e4f', '#4fd9c9'];

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    city,
    player: null,
    cars: [],
    peds: [],
    officers: [],
    policeCars: [],
    bullets: [],
    pickups: [],
    heat: 0,
    stars: 0,
    cash: 250,
    clockMinutes: CLOCK.startHour * 60 + CLOCK.startMinute,
    elapsed: 0,
    missionId: null,
    missionStep: 0,
    missionTimer: 0,
    missionActive: false,
    dialogue: null,
    toast: null,
    completed: [],
    stats: { carsStolen: 0, pedsHit: 0, copsDown: 0, missionsDone: 0, playSeconds: 0 },
    ended: null, // 'busted' | 'wasted' | null
    bustTimer: 0,
    spawnTimer: 0,
  };

  function spawnCar(x, y, angle, model, opts) {
    const car = {
      x, y, angle, speed: 0,
      model: model || random.pick(CAR_MODELS),
      color: (opts && opts.color) || null,
      kind: 'parked',
      driver: null,
      isPolice: !!(opts && opts.police),
      isPlayer: false,
      isTarget: !!(opts && opts.target),
      traffic: null,
      health: 100,
      skid: 0,
    };
    if (car.color === null) car.color = car.model.color;
    state.cars.push(car);
    return car;
  }

  function spawnPed(x, y) {
    const ped = {
      x, y, angle: random.range(0, Math.PI * 2),
      speed: 0, state: 'walk', health: 30,
      shirt: random.pick(PED_SHIRTS),
      targetX: x, targetY: y,
      fleeX: 0, fleeY: 0, down: false, downTimer: 0,
    };
    state.peds.push(ped);
    return ped;
  }

  function randomRoadPoint() {
    if (random() < 0.5) {
      return { x: random.pick(WORLD.avenues) + random.range(-22, 22), y: random.range(120, WORLD.height - 200) };
    }
    return { x: random.range(120, WORLD.width - 120), y: random.pick(WORLD.streets) + random.range(-22, 22) };
  }

  function populate() {
    state.cars = [];
    state.peds = [];
    state.officers = [];
    state.policeCars = [];
    state.bullets = [];
    state.pickups = [];
    // Parked cars along the roads.
    for (let i = 0; i < 16; i += 1) {
      const p = randomRoadPoint();
      const vertical = Math.abs(p.x - 300) < 200 || WORLD.avenues.some((a) => Math.abs(p.x - a) < 30);
      spawnCar(p.x, p.y, vertical ? Math.PI / 2 : 0, null, {});
    }
    // The gold Comet GT for the Repo Run, outside the Grand Hotel.
    spawnCar(2100, 1150 + 58, 0, CAR_MODELS[1], { target: true });
    // Traffic cars driving the grid.
    for (let i = 0; i < TRAFFIC.count; i += 1) {
      const p = randomRoadPoint();
      const vertical = WORLD.avenues.some((a) => Math.abs(p.x - a) < 30);
      const car = spawnCar(p.x, p.y, vertical ? Math.PI / 2 : 0, null, {});
      car.kind = 'traffic';
      car.traffic = {
        vertical,
        dir: random() < 0.5 ? 1 : -1,
        lane: random() < 0.5 ? -22 : 22,
        speed: TRAFFIC.carSpeed * random.range(0.8, 1.2),
      };
      car.speed = car.traffic.speed;
    }
    // Pedestrians on the sidewalks.
    for (let i = 0; i < TRAFFIC.pedCount; i += 1) {
      const p = randomRoadPoint();
      const ped = spawnPed(p.x + random.range(-70, 70), p.y + random.range(-70, 70));
      const t = city.nearestIntersection(ped.x, ped.y);
      ped.targetX = t.x + random.range(-60, 60);
      ped.targetY = t.y + random.range(-60, 60);
    }
    // Cash, ammo and health pickups around the city.
    const pickupKinds = ['cash', 'cash', 'cash', 'cash', 'ammo', 'ammo', 'health', 'cash', 'ammo', 'cash', 'health', 'cash'];
    for (const kind of pickupKinds) {
      const p = randomRoadPoint();
      state.pickups.push({ x: p.x + random.range(-60, 60), y: p.y + random.range(-60, 60), kind, active: true, bob: random.range(0, 6) });
    }
  }

  function reset() {
    populate();
    state.player = {
      x: 1500, y: 1980, angle: -Math.PI / 2, health: PLAYER.health,
      radius: PLAYER.radius,
      ammo: PLAYER.pistolAmmo, inCar: null, speed: 0,
      punchTimer: 0, reloadTimer: 0, hurtTimer: 0, fireTimer: 0, lastDamage: -99,
      moving: false, aimAngle: 0,
    };
    state.heat = 0;
    state.stars = 0;
    state.cash = 250;
    state.clockMinutes = CLOCK.startHour * 60 + CLOCK.startMinute;
    state.elapsed = 0;
    state.missionId = null;
    state.missionStep = 0;
    state.missionTimer = 0;
    state.missionActive = false;
    state.dialogue = null;
    state.toast = null;
    state.completed = [];
    state.stats = { carsStolen: 0, pedsHit: 0, copsDown: 0, missionsDone: 0, playSeconds: 0 };
    state.ended = null;
    state.bustTimer = 0;
    state.spawnTimer = 0;
    state.fine = undefined;
  }

  function starsFor(heat) {
    if (heat < 8) return 0;
    return Math.min(5, Math.ceil(heat / 20));
  }

  function addHeat(amount) {
    state.heat = Math.min(100, state.heat + amount);
    state.stars = starsFor(state.heat);
  }

  function say(speaker, text, seconds) {
    state.dialogue = { speaker, text, until: state.elapsed + (seconds || 6) };
  }

  function toast(text, seconds) {
    state.toast = { text, until: state.elapsed + (seconds || 4) };
  }

  function currentMission() {
    return state.missionId ? missionById(state.missionId) : null;
  }

  function currentStep() {
    const m = currentMission();
    return m ? m.steps[state.missionStep] || null : null;
  }

  function startMission(id) {
    const m = missionById(id);
    if (!m) return false;
    state.missionId = id;
    state.missionStep = 0;
    state.missionTimer = 0;
    state.missionActive = true;
    state.ended = null;
    say('Cassie Vale', m.briefing, 8);
    toast(`New mission: ${m.title} — $${m.reward}`, 5);
    return true;
  }

  function advanceStep(reward) {
    const m = currentMission();
    if (!m) return;
    if (reward) {
      state.cash += reward;
    }
    state.missionStep += 1;
    state.missionTimer = 0;
    if (state.missionStep >= m.steps.length) {
      state.completed.push(m.id);
      state.stats.missionsDone += 1;
      state.missionActive = false;
      state.missionId = null;
      state.missionStep = 0;
      say('Cassie Vale', `"${m.title}" done. $${m.reward} is yours, Milo. Vince is smiling — for once.`, 7);
      toast(`Mission complete: ${m.title}  +$${m.reward}`, 6);
    } else {
      const next = m.steps[state.missionStep];
      if (next.type === 'escape') addHeat(70);
      if (next.type === 'chase') addHeat(35);
      toast(next.text, 5);
    }
  }

  function failMission(reason) {
    const m = currentMission();
    state.missionActive = false;
    state.missionId = null;
    state.missionStep = 0;
    state.missionTimer = 0;
    state.heat = 0;
    state.stars = 0;
    if (m) {
      say('Cassie Vale', `"${m.title}" fell apart — ${reason}. Shake it off, come back to the garage and we run it again.`, 7);
      toast(`Mission failed: ${m.title}`, 5);
    }
  }

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of state.cars) {
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function tryEnterCar() {
    const p = state.player;
    const car = nearestCar(p.x, p.y, 64);
    if (!car) return 0;
    if (car.driver) {
      const driver = car.driver;
      car.driver = null;
      driver.state = 'flee';
      driver.fleeX = p.x;
      driver.fleeY = p.y;
      driver.targetX = p.x + (p.x - car.x) * 4;
      driver.targetY = p.y + (p.y - car.y) * 4;
    }
    car.kind = 'player';
    car.isPlayer = true;
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    state.stats.carsStolen += 1;
    addHeat(CRIME_HEAT.stealCar);
    say('', 'You took the car. The Solmar Bay PD noticed.', 3);
    return EVENT_STEAL;
  }

  function exitCar() {
    const p = state.player;
    const car = p.inCar;
    if (!car) return;
    car.kind = 'parked';
    car.isPlayer = false;
    car.speed = 0;
    p.inCar = null;
    const side = Math.cos(car.angle + Math.PI / 2);
    const sideY = Math.sin(car.angle + Math.PI / 2);
    p.x = car.x + side * 34;
    p.y = car.y + sideY * 34;
    city.resolveCircle(p);
    p.angle = car.angle;
  }

  function fireBullet(fromX, fromY, angle, from, damage) {
    state.bullets.push({
      x: fromX + Math.cos(angle) * 22,
      y: fromY + Math.sin(angle) * 22,
      vx: Math.cos(angle) * 920,
      vy: Math.sin(angle) * 920,
      life: 0.6, from, damage,
    });
  }

  function punch() {
    const p = state.player;
    if (p.inCar || p.punchTimer > 0) return 0;
    p.punchTimer = 0.32;
    let hit = false;
    const targets = [...state.officers, ...state.peds.filter((pd) => !pd.down)];
    for (const t of targets) {
      const d = dist(p.x, p.y, t.x, t.y);
      if (d > PLAYER.punchRange + 14) continue;
      const a = angleTo(p.x, p.y, t.x, t.y);
      if (Math.abs(angleDiff(p.aimAngle, a)) > PLAYER.punchArc) continue;
      t.health -= PLAYER.punchDamage;
      hit = true;
      if (t.health <= 0) {
        if (state.officers.includes(t)) {
          t.dead = true;
          state.stats.copsDown += 1;
          addHeat(CRIME_HEAT.killCop);
          state.cash += 60;
        } else {
          t.down = true;
          t.downTimer = 20;
          state.stats.pedsHit += 1;
          addHeat(CRIME_HEAT.killPed);
        }
      }
    }
    return hit ? EVENT_PUNCH : EVENT_PUNCH;
  }

  function shoot() {
    const p = state.player;
    if (p.inCar || p.ammo <= 0 || p.reloadTimer > 0 || p.fireTimer > 0) return 0;
    p.ammo -= 1;
    p.fireTimer = 0.22;
    fireBullet(p.x, p.y, p.aimAngle, 'player', PLAYER.pistolDamage);
    addHeat(CRIME_HEAT.shoot);
    return EVENT_SHOT;
  }

  function damagePlayer(amount) {
    const p = state.player;
    if (p.hurtTimer > 0 || state.ended) return;
    p.health -= amount;
    p.hurtTimer = 0.25;
    p.lastDamage = state.elapsed;
    if (p.health <= 0) {
      p.health = 0;
      state.ended = 'wasted';
    }
  }

  function updatePlayer(dt, input) {
    const p = state.player;
    if (state.ended) return 0;
    let events = 0;
    if (p.punchTimer > 0) p.punchTimer -= dt;
    if (p.reloadTimer > 0) p.reloadTimer -= dt;
    if (p.hurtTimer > 0) p.hurtTimer -= dt;
    if (p.fireTimer > 0) p.fireTimer -= dt;
    if (p.health < PLAYER.health && state.elapsed - p.lastDamage > 6) {
      p.health = Math.min(PLAYER.health, p.health + 3 * dt);
    }
    p.aimAngle = input.aimAngle !== undefined ? input.aimAngle : p.aimAngle;

    if (input.interact) {
      if (p.inCar) exitCar();
      else events |= tryEnterCar();
    }
    if (input.punch) events |= punch();
    if (input.shoot) events |= shoot();
    if (input.reload && p.ammo < PLAYER.pistolAmmo && p.reloadTimer <= 0) {
      p.reloadTimer = PLAYER.reloadSeconds;
      p.ammo = PLAYER.pistolAmmo;
    }

    if (p.inCar) {
      const car = p.inCar;
      const steer = input.mx;
      const throttle = -input.my; // W (my=-1) is forward
      const speedRatio = Math.abs(car.speed) / CAR.maxSpeed;
      if (throttle > 0) car.speed += CAR.accel * throttle * dt * (car.model ? car.model.speed : 1);
      else if (throttle < 0) {
        if (car.speed > 10) car.speed -= CAR.brake * dt;
        else car.speed -= CAR.reverseAccel * dt;
      } else {
        car.speed -= car.speed * 0.9 * dt;
      }
      if (input.handbrake) {
        car.speed -= car.speed * 1.6 * dt;
        car.angle += steer * CAR.steer * 1.7 * dt * Math.sign(car.speed || 1);
      } else {
        car.angle += steer * CAR.steer * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
      }
      car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const probe = { x: nx, y: ny, radius: 24 };
      if (city.resolveCircle(probe)) {
        car.x = probe.x;
        car.y = probe.y;
        if (Math.abs(car.speed) > 200) {
          events |= EVENT_CRASH;
          car.speed *= -0.25;
        } else {
          car.speed *= 0.4;
        }
      } else {
        car.x = nx;
        car.y = ny;
      }
      // Car vs car shunts.
      for (const other of state.cars) {
        if (other === car) continue;
        const d = dist(car.x, car.y, other.x, other.y);
        if (d < 52 && d > 0.01) {
          const push = (52 - d) / 2;
          const ux = (car.x - other.x) / d;
          const uy = (car.y - other.y) / d;
          car.x += ux * push;
          car.y += uy * push;
          if (other.kind !== 'player') {
            other.x -= ux * push;
            other.y -= uy * push;
          }
          if (Math.abs(car.speed) > 260) {
            events |= EVENT_CRASH;
            car.speed *= 0.5;
            if (other.isPolice) addHeat(CRIME_HEAT.ramCop);
          }
        }
      }
      // Running over pedestrians.
      for (const ped of state.peds) {
        if (ped.down) continue;
        const d = dist(car.x, car.y, ped.x, ped.y);
        if (d < 30 && Math.abs(car.speed) > 60) {
          ped.down = true;
          ped.downTimer = 25;
          ped.health = 0;
          state.stats.pedsHit += 1;
          addHeat(CRIME_HEAT.hitPed);
          events |= EVENT_HIT;
          car.speed *= 0.85;
        }
      }
      car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
      car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = car.speed;
      p.moving = Math.abs(car.speed) > 20;
    } else {
      const len = Math.hypot(input.mx, input.my);
      p.moving = len > 0;
      if (len > 0) {
        const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
        const nx = p.x + (input.mx / len) * speed * dt;
        const ny = p.y + (input.my / len) * speed * dt;
        p.x = nx;
        p.y = ny;
        p.angle = Math.atan2(input.my, input.mx);
        city.resolveCircle(p);
        p.x = Math.max(20, Math.min(WORLD.width - 20, p.x));
        p.y = Math.max(20, Math.min(WORLD.height - 20, p.y));
      }
      // Pickups on foot.
      for (const pk of state.pickups) {
        if (!pk.active) continue;
        if (dist(p.x, p.y, pk.x, pk.y) < 30) {
          pk.active = false;
          if (pk.kind === 'cash') {
            state.cash += 50;
            events |= EVENT_CASH;
            toast('+$50 street cash', 2);
          } else if (pk.kind === 'ammo') {
            p.ammo = PLAYER.pistolMaxAmmo;
            events |= EVENT_PICKUP;
            toast('Ammo restocked', 2);
          } else {
            p.health = PLAYER.health;
            events |= EVENT_PICKUP;
            toast('Patched up — full health', 2);
          }
        }
      }
      // Traffic cars can run the player down.
      for (const car of state.cars) {
        if (car.kind !== 'traffic') continue;
        const d = dist(p.x, p.y, car.x, car.y);
        if (d < 30 && Math.abs(car.speed) > 80) {
          damagePlayer(22);
          p.x += (p.x - car.x) / (d || 1) * 26;
          p.y += (p.y - car.y) / (d || 1) * 26;
          events |= EVENT_HIT;
        }
      }
    }
    return events;
  }

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic' || !car.traffic) continue;
      const t = car.traffic;
      // Slow for the car ahead on the same road.
      let target = t.speed;
      for (const other of state.cars) {
        if (other === car || other.kind !== 'traffic') continue;
        const ahead = t.vertical
          ? Math.abs(other.x - car.x) < 40 && (other.y - car.y) * t.dir > 0 && (other.y - car.y) * t.dir < 90
          : Math.abs(other.y - car.y) < 40 && (other.x - car.x) * t.dir > 0 && (other.x - car.x) * t.dir < 90;
        if (ahead) target = 0;
      }
      // Slow for the player's car right ahead.
      const pc = state.player.inCar;
      if (pc) {
        const ahead = t.vertical
          ? Math.abs(pc.x - car.x) < 44 && (pc.y - car.y) * t.dir > 0 && (pc.y - car.y) * t.dir < 90
          : Math.abs(pc.y - car.y) < 44 && (pc.x - car.x) * t.dir > 0 && (pc.x - car.x) * t.dir < 90;
        if (ahead) target = 0;
      }
      car.speed += (target - car.speed) * Math.min(1, dt * 2);
      if (t.vertical) {
        car.y += t.dir * car.speed * dt;
        car.angle = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        // Keep to the lane.
        const roadX = city.nearestRoadPoint(car.x, car.y).x;
        car.x += (roadX + t.lane - car.x) * Math.min(1, dt * 3);
        if (car.y < 60 || car.y > WORLD.height - 80) {
          t.dir *= -1;
          car.y = Math.max(60, Math.min(WORLD.height - 80, car.y));
        }
        // Random turn at an intersection.
        if (WORLD.streets.some((s) => Math.abs(car.y - s) < 4) && random() < 0.004) {
          t.vertical = false;
          t.dir = random() < 0.5 ? 1 : -1;
          t.lane = random() < 0.5 ? -22 : 22;
        }
      } else {
        car.x += t.dir * car.speed * dt;
        car.angle = t.dir > 0 ? 0 : Math.PI;
        const roadY = city.nearestRoadPoint(car.x, car.y).y;
        car.y += (roadY + t.lane - car.y) * Math.min(1, dt * 3);
        if (car.x < 60 || car.x > WORLD.width - 60) {
          t.dir *= -1;
          car.x = Math.max(60, Math.min(WORLD.width - 60, car.x));
        }
        if (WORLD.avenues.some((a) => Math.abs(car.x - a) < 4) && random() < 0.004) {
          t.vertical = true;
          t.dir = random() < 0.5 ? 1 : -1;
          t.lane = random() < 0.5 ? -22 : 22;
        }
      }
    }
  }

  function updatePeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.down = false;
          ped.health = 30;
        }
        continue;
      }
      const dp = dist(ped.x, ped.y, p.x, p.y);
      const scared = state.stars > 0 && dp < 260;
      const carNear = p.inCar && Math.abs(p.inCar.speed) > 200 && dp < 130;
      if ((scared || carNear) && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.fleeX = ped.x;
        ped.fleeY = ped.y;
      }
      if (ped.state === 'flee') {
        const away = angleTo(p.x, p.y, ped.x, ped.y);
        ped.x += Math.cos(away) * TRAFFIC.pedSpeed * 2.4 * dt;
        ped.y += Math.sin(away) * TRAFFIC.pedSpeed * 2.4 * dt;
        ped.angle = away;
        ped.radius = 10;
        city.resolveCircle(ped);
        if (dp > 420) ped.state = 'walk';
      } else {
        const d = dist(ped.x, ped.y, ped.targetX, ped.targetY);
        if (d < 24) {
          const t = city.nearestIntersection(ped.x + random.range(-500, 500), ped.y + random.range(-500, 500));
          ped.targetX = Math.max(40, Math.min(WORLD.width - 40, t.x + random.range(-70, 70)));
          ped.targetY = Math.max(40, Math.min(WORLD.height - 40, t.y + random.range(-70, 70)));
        } else {
          const a = angleTo(ped.x, ped.y, ped.targetX, ped.targetY);
          ped.x += Math.cos(a) * TRAFFIC.pedSpeed * dt;
          ped.y += Math.sin(a) * TRAFFIC.pedSpeed * dt;
          ped.angle = a;
          ped.radius = 10;
          city.resolveCircle(ped);
        }
      }
      ped.x = Math.max(20, Math.min(WORLD.width - 20, ped.x));
      ped.y = Math.max(20, Math.min(WORLD.height - 20, ped.y));
    }
  }

  function spawnPolice(dt) {
    const wantCars = POLICE.carsPerStar[state.stars] || 0;
    const wantOfficers = POLICE.officersPerStar[state.stars] || 0;
    state.spawnTimer -= dt;
    if (state.spawnTimer > 0) return;
    state.spawnTimer = 0.5;
    const p = state.player;
    if (state.policeCars.length < wantCars) {
      // A patrol car rolls in from a nearby road, off the player's view.
      const a = random.range(0, Math.PI * 2);
      const sx = p.x + Math.cos(a) * 750;
      const sy = p.y + Math.sin(a) * 750;
      const rp = city.nearestRoadPoint(Math.max(80, Math.min(WORLD.width - 80, sx)), Math.max(80, Math.min(WORLD.height - 80, sy)));
      const car = spawnCar(rp.x, rp.y, 0, CAR_MODELS[0], { police: true });
      car.kind = 'police';
      car.color = '#1d3a5f';
      state.policeCars.push(car);
    }
    if (state.officers.length < wantOfficers) {
      const a = random.range(0, Math.PI * 2);
      const ox = Math.max(40, Math.min(WORLD.width - 40, p.x + Math.cos(a) * 420));
      const oy = Math.max(40, Math.min(WORLD.height - 40, p.y + Math.sin(a) * 420));
      state.officers.push({ x: ox, y: oy, angle: 0, health: POLICE.officerHealth, shootTimer: random.range(0.4, 1), bustTimer: 0, dead: false });
    }
  }

  function updatePolice(dt) {
    const p = state.player;
    let events = 0;
    // Cull police that drifted far away once the heat is gone.
    if (state.stars === 0) {
      for (const car of state.policeCars) {
        if (dist(car.x, car.y, p.x, p.y) > 1400) {
          state.cars.splice(state.cars.indexOf(car), 1);
        }
      }
      state.policeCars = state.policeCars.filter((c) => state.cars.includes(c));
      state.officers = state.officers.filter((o) => !o.dead && dist(o.x, o.y, p.x, p.y) < 1400);
    }
    for (const car of state.policeCars) {
      if (!state.cars.includes(car)) continue;
      const target = p.inCar || p;
      const desired = angleTo(car.x, car.y, target.x, target.y);
      const diff = angleDiff(car.angle, desired);
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const wantSpeed = state.stars > 0 ? POLICE.carSpeed : 120;
      car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.4);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const probe = { x: nx, y: ny, radius: 24 };
      if (city.resolveCircle(probe)) {
        car.x = probe.x;
        car.y = probe.y;
        car.speed *= 0.55;
        car.angle += 0.9 * dt * (random() < 0.5 ? 1 : -1);
      } else {
        car.x = nx;
        car.y = ny;
      }
      // Ramming the player's car.
      if (p.inCar) {
        const d = dist(car.x, car.y, p.inCar.x, p.inCar.y);
        if (d < 56) {
          const ux = (p.inCar.x - car.x) / (d || 1);
          const uy = (p.inCar.y - car.y) / (d || 1);
          p.inCar.x += ux * 11 * dt * 10;
          p.inCar.y += uy * 11 * dt * 10;
          p.inCar.speed *= 0.92;
          if (Math.abs(car.speed) > 240) {
            events |= EVENT_CRASH;
            car.speed *= 0.6;
          }
        }
      } else {
        // On foot, a patrol car stops short and the officer gets out.
        const d = dist(car.x, car.y, p.x, p.y);
        if (d < 120 && state.officers.length < (POLICE.officersPerStar[state.stars] || 0) + 1) {
          car.speed = 0;
        }
      }
    }
    for (const o of state.officers) {
      if (o.dead) continue;
      const d = dist(o.x, o.y, p.x, p.y);
      if (state.stars === 0) {
        o.bustTimer = 0;
        continue;
      }
      if (p.inCar) {
        // Officers cannot catch a car: they hold position and radio it in.
        o.shootTimer -= dt;
        if (o.shootTimer <= 0 && d < POLICE.shootRange) {
          o.shootTimer = POLICE.shootCooldown * 1.6;
          fireBullet(o.x, o.y, angleTo(o.x, o.y, p.x, p.y) + random.range(-0.08, 0.08), 'police', POLICE.bulletDamage);
          events |= EVENT_SHOT;
        }
        continue;
      }
      const a = angleTo(o.x, o.y, p.x, p.y);
      o.angle = a;
      if (d > POLICE.bustRange + 6) {
        o.x += Math.cos(a) * POLICE.officerSpeed * dt;
        o.y += Math.sin(a) * POLICE.officerSpeed * dt;
        o.radius = 12;
        city.resolveCircle(o);
        o.bustTimer = 0;
      } else {
        // Close enough to make the arrest.
        o.bustTimer += dt;
        if (o.bustTimer >= POLICE.bustSeconds) {
          state.ended = 'busted';
          events |= EVENT_BUSTED;
        }
      }
      o.shootTimer -= dt;
      if (o.shootTimer <= 0 && d < POLICE.shootRange && d > 90) {
        o.shootTimer = POLICE.shootCooldown;
        fireBullet(o.x, o.y, a + random.range(-0.1, 0.1), 'police', POLICE.bulletDamage);
        events |= EVENT_SHOT;
      }
    }
    state.officers = state.officers.filter((o) => !o.dead);
    return events;
  }

  function updateBullets(dt) {
    let events = 0;
    const p = state.player;
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height) {
        b.life = 0;
        continue;
      }
      const probe = { x: b.x, y: b.y, radius: 2 };
      if (state.city.resolveCircle(probe)) {
        b.life = 0;
        continue;
      }
      if (b.from === 'player') {
        for (const o of state.officers) {
          if (o.dead) continue;
          if (dist(b.x, b.y, o.x, o.y) < 18) {
            o.health -= b.damage;
            b.life = 0;
            if (o.health <= 0) {
              o.dead = true;
              state.stats.copsDown += 1;
              addHeat(CRIME_HEAT.killCop);
              state.cash += 60;
              events |= EVENT_CASH;
            }
            break;
          }
        }
        if (b.life > 0) {
          for (const ped of state.peds) {
            if (ped.down) continue;
            if (dist(b.x, b.y, ped.x, ped.y) < 16) {
              ped.health -= b.damage;
              b.life = 0;
              if (ped.health <= 0) {
                ped.down = true;
                ped.downTimer = 25;
                state.stats.pedsHit += 1;
                addHeat(CRIME_HEAT.killPed);
              }
              break;
            }
          }
        }
      } else if (!p.inCar && dist(b.x, b.y, p.x, p.y) < 16) {
        damagePlayer(b.damage);
        b.life = 0;
        events |= EVENT_HIT;
      } else if (p.inCar && dist(b.x, b.y, p.inCar.x, p.inCar.y) < 28) {
        // A bullet into the car chips the driver.
        if (random() < 0.5) damagePlayer(b.damage * 0.5);
        b.life = 0;
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    return events;
  }

  function updateMissions(dt) {
    if (!state.missionActive || state.ended) return 0;
    const step = currentStep();
    if (!step) return 0;
    const p = state.player;
    let events = 0;
    if (step.type === 'goto') {
      if (dist(p.x, p.y, step.x, step.y) < step.radius) {
        advanceStep(step.reward);
        events |= EVENT_MISSION;
      }
    } else if (step.type === 'steal') {
      if (p.inCar) {
        const ok = !step.x || dist(p.inCar.x, p.inCar.y, step.x, step.y) < step.radius;
        if (ok) {
          advanceStep(step.reward);
          events |= EVENT_MISSION;
        }
      }
    } else if (step.type === 'chase') {
      state.missionTimer += dt;
      if (state.missionTimer >= step.seconds) {
        state.heat = 0;
        state.stars = 0;
        advanceStep(step.reward);
        events |= EVENT_MISSION;
      }
    } else if (step.type === 'escape') {
      if (dist(p.x, p.y, step.x, step.y) < step.radius) {
        state.heat = 0;
        state.stars = 0;
        advanceStep(step.reward);
        events |= EVENT_MISSION;
      }
    }
    return events;
  }

  function updateWanted(dt) {
    if (state.ended) return;
    // Heat cools when the player has been quiet and the police are far away.
    const p = state.player;
    let nearestCop = Infinity;
    for (const car of state.policeCars) nearestCop = Math.min(nearestCop, dist(car.x, car.y, p.x, p.y));
    for (const o of state.officers) nearestCop = Math.min(nearestCop, dist(o.x, o.y, p.x, p.y));
    if (state.heat > 0 && nearestCop > 500) {
      state.heat = Math.max(0, state.heat - CRIME_HEAT.decayPerSecond * dt);
      state.stars = starsFor(state.heat);
    }
  }

  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.stats.playSeconds += dt;
    state.clockMinutes += (dt / CLOCK.secondsPerHour) * 60;
    if (state.clockMinutes >= 24 * 60) state.clockMinutes -= 24 * 60;
    if (state.dialogue && state.elapsed > state.dialogue.until) state.dialogue = null;
    if (state.toast && state.elapsed > state.toast.until) state.toast = null;

    if (!harmless) {
      events |= updatePlayer(dt, input);
      if (state.ended === 'wasted') events |= EVENT_WASTED;
      else if (state.ended === 'busted') events |= EVENT_BUSTED;
    }
    updateTraffic(dt);
    updatePeds(dt);
    spawnPolice(dt);
    events |= updatePolice(dt);
    events |= updateBullets(dt);
    events |= updateMissions(dt);
    updateWanted(dt);
    return events;
  }

  function getSave() {
    return {
      cash: state.cash,
      completed: [...state.completed],
      bestCash: Math.max(state.cash, 0),
      stats: { ...state.stats },
    };
  }

  function applySave(save) {
    if (!save) return;
    if (typeof save.cash === 'number') state.cash = save.cash;
    if (Array.isArray(save.completed)) state.completed = save.completed.filter((id) => MISSIONS.some((m) => m.id === id));
  }

  reset();
  return {
    state, reset, step, startMission, failMission, currentMission, currentStep,
    nextMission: () => nextMission(state.completed),
    addHeat, getSave, applySave, say, toast,
  };
}
