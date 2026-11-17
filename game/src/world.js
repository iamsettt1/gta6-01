// Solmar Bay's rules: the player on foot and behind the wheel, traffic and
// pedestrians, the wanted level and the police answer, pistol combat, pickups
// and the clock. The renderer draws this state; main.js feeds it input.

import { WORLD_W, WORLD_H, ROAD_W, ROADS_V, ROADS_H, SEA_X, TUNING, PALETTE, CAR_MODELS } from './config.js';
import { makeRng, clamp, dist2, angleTo, angleDiff } from './random.js';
import { buildCity, isOnRoad, resolveCircle, nearestRoadPoint, randomRoadPoint } from './city.js';
import { MISSIONS, startMission, updateMission } from './missions.js';

let nextId = 1;

export function createWorld(seed) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const world = {
    seed,
    rng,
    city,
    time: 0,
    mode: 'title', // title | play | pause | busted | wasted | missions
    player: {
      x: 1500, y: 1450, angle: 0, hp: TUNING.playerMaxHp,
      inCar: false, carId: null, mag: TUNING.magSize, reserve: TUNING.startReserve,
      walkX: 0, walkY: 0, moving: false,
    },
    cars: [],
    peds: [],
    police: [],
    policeCars: [],
    bullets: [],
    particles: [],
    pickups: [],
    wanted: 0,
    crimeTimer: 0,
    cash: 120,
    clockMinutes: TUNING.clockStartMinutes,
    mission: null,
    pendingMission: null,
    nextMissionAt: 0,
    banner: null,
    deathT: 0,
    bustT: 0,
    stats: { missionsDone: 0, carsStolen: 0, shotsFired: 0, pedsHit: 0, distanceDriven: 0, playSeconds: 0 },
    shotCooldown: 0,
    pickupTimer: 8,
    auto: null, // autopilot writes here in ?shot= scenes
    message: null,
  };

  spawnParkedCars(world, 12);
  spawnTrafficCars(world, 14);
  spawnPeds(world, 26);
  spawnPickups(world);
  wireMissionHooks(world);
  return world;
}

function spawnParkedCars(world, count) {
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(world.city, world.rng);
    const along = p.axis === 'v';
    const side = world.rng.chance(0.5) ? 1 : -1;
    // Park at the kerb, inside the road: the old offset (road edge + 18) put
    // cars on the block boundary where they could overlap a building.
    const kerb = ROAD_W / 2 - 22;
    const x = along ? p.x + side * kerb : clamp(p.x + world.rng.range(-300, 300), 60, SEA_X - 60);
    const y = along ? clamp(p.y + world.rng.range(-300, 300), 60, WORLD_H - 60) : p.y + side * kerb;
    const model = world.rng.pick(CAR_MODELS);
    world.cars.push({
      id: nextId++, x, y,
      angle: along ? (world.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (world.rng.chance(0.5) ? 0 : Math.PI),
      speed: 0, color: world.rng.pick(PALETTE.carColors), model,
      kind: 'civil', parked: true, hp: 100, driver: 'none', traffic: null, dist: 0, wrecked: false,
    });
  }
}

function spawnTrafficCars(world, count) {
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(world.city, world.rng);
    const dir = world.rng.chance(0.5) ? 1 : -1;
    const lane = dir > 0 ? -14 : 14;
    const model = world.rng.pick(CAR_MODELS);
    const taxi = world.rng.chance(0.18);
    world.cars.push({
      id: nextId++, x: p.axis === 'v' ? p.x + lane : p.x, y: p.axis === 'h' ? p.y + lane : p.y,
      angle: p.axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: TUNING.trafficSpeed * world.rng.range(0.8, 1.1),
      color: taxi ? '#f2c200' : world.rng.pick(PALETTE.carColors), model,
      kind: taxi ? 'taxi' : 'civil', parked: false, hp: 100, driver: 'ped',
      traffic: { axis: p.axis, dir }, dist: 0, wrecked: false,
    });
  }
}

function spawnPeds(world, count) {
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(world.city, world.rng);
    const axis = world.rng.chance(0.5) ? 'v' : 'h';
    const side = world.rng.chance(0.5) ? 1 : -1;
    const x = axis === 'v' ? p.x + side * (ROAD_W / 2 + 34) : clamp(p.x + world.rng.range(-400, 400), 60, SEA_X - 60);
    const y = axis === 'h' ? p.y + side * (ROAD_W / 2 + 34) : clamp(p.y + world.rng.range(-400, 400), 60, WORLD_H - 60);
    world.peds.push({
      id: nextId++, x, y, angle: world.rng.range(0, Math.PI * 2),
      speed: TUNING.pedSpeed * world.rng.range(0.7, 1.2),
      color: world.rng.pick(PALETTE.pedColors),
      state: 'walk', axis, dir: world.rng.chance(0.5) ? 1 : -1,
      fleeT: 0, downT: 0, courier: false, fx: 0, fy: 0,
    });
  }
}

const PICKUP_SPOTS = [
  { x: 960, y: 1240, kind: 'health' },
  { x: 2040, y: 860, kind: 'ammo' },
  { x: 1560, y: 1740, kind: 'health' },
  { x: 2640, y: 1240, kind: 'ammo' },
  { x: 420, y: 860, kind: 'health' },
  { x: 3060, y: 1740, kind: 'ammo' },
];

function spawnPickups(world) {
  world.pickups = PICKUP_SPOTS.map((s) => ({ x: s.x, y: s.y, kind: s.kind, bob: world.rng.range(0, 6) }));
}

export function addHeat(world, amount) {
  world.wanted = clamp(world.wanted + amount, 0, TUNING.maxWanted);
  world.crimeTimer = 0;
}

function nearestCar(world, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of world.cars) {
    if (car.wrecked) continue;
    const d = dist2(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterCar(world, car) {
  const p = world.player;
  if (car.driver === 'ped') {
    // The driver bails out and runs.
    const ped = {
      id: nextId++, x: car.x + 40, y: car.y + 30, angle: 0,
      speed: TUNING.pedFleeSpeed, color: '#e74c3c', state: 'flee',
      axis: 'v', dir: 1, fleeT: 4, downT: 0, courier: false, fx: car.x + 200, fy: car.y + 200,
    };
    world.peds.push(ped);
    car.driver = 'none';
  }
  const stolen = car.kind !== 'police' && car.driver !== 'player' && (car.parked || car.traffic);
  if (stolen && car.id !== world.lastCarId) {
    addHeat(world, car.kind === 'police' ? 2 : TUNING.stealHeat);
    world.stats.carsStolen += 1;
    world.banner = { text: 'CAR STOLEN', sub: 'The police have been called', t: 2.5 };
  }
  car.parked = false;
  car.traffic = null;
  car.driver = 'player';
  p.inCar = true;
  p.carId = car.id;
  world.lastCarId = car.id;
}

function exitCar(world) {
  const p = world.player;
  const car = world.cars.find((c) => c.id === p.carId);
  if (!car) {
    p.inCar = false;
    p.carId = null;
    return;
  }
  car.driver = 'none';
  car.speed = 0;
  const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 34, y: car.y + Math.sin(car.angle + Math.PI / 2) * 34 };
  p.x = side.x;
  p.y = side.y;
  resolveCircle(world.city, p, 14);
  p.inCar = false;
  p.carId = null;
}

export function respawn(world, kind) {
  const p = world.player;
  if (kind === 'busted') {
    const fine = Math.min(world.cash, TUNING.bustFine);
    world.cash -= fine;
    world.banner = { text: 'BUSTED', sub: `Fine paid: $${fine}`, t: 3 };
  } else {
    const loss = Math.min(world.cash, TUNING.wastedLoss);
    world.cash -= loss;
    world.banner = { text: 'WASTED', sub: `Hospital bill: $${loss}`, t: 3 };
  }
  world.wanted = 0;
  world.police = [];
  world.policeCars = [];
  for (const car of world.cars) if (car.kind === 'police') car.wrecked = true;
  p.x = 2640;
  p.y = 360;
  p.hp = TUNING.playerMaxHp;
  p.inCar = false;
  p.carId = null;
  p.mag = TUNING.magSize;
  p.reserve = Math.max(p.reserve, 24);
  world.mode = 'play';
  world.deathT = 0;
  world.bustT = 0;
}

// Mission staging is wired here: when a job starts, the world prepares what
// that job needs (the target car, the courier, the opening heat).
export function wireMissionHooks(world) {
  world.onMissionStart = (w, def) => stageMissionWorld(w, def);
}

export function update(world, input, dt) {
  world.time += dt;
  world.stats.playSeconds += dt;
  world.clockMinutes += dt * TUNING.clockMinutesPerSecond;
  if (world.banner) {
    world.banner.t -= dt;
    if (world.banner.t <= 0) world.banner = null;
  }
  world.shotCooldown = Math.max(0, world.shotCooldown - dt);

  const p = world.player;
  const city = world.city;

  // --- Player on foot or driving ---
  if (p.inCar) {
    updateDriving(world, input, dt);
  } else {
    updateOnFoot(world, input, dt);
  }

  // --- Enter / exit a car ---
  if (input.enter) {
    if (p.inCar) {
      exitCar(world);
    } else {
      const car = nearestCar(world, p.x, p.y, 70);
      if (car) enterCar(world, car);
    }
  }

  // --- Pistol ---
  if (input.shoot && world.shotCooldown <= 0) {
    fireShot(world, input);
  }
  if (input.reload && p.mag < TUNING.magSize && p.reserve > 0) {
    const need = TUNING.magSize - p.mag;
    const take = Math.min(need, p.reserve);
    p.mag += take;
    p.reserve -= take;
    world.audioEvent = 'reload';
  }

  updateTraffic(world, dt);
  updatePeds(world, dt);
  updatePolice(world, dt);
  updateBullets(world, dt);
  updateParticles(world, dt);
  updatePickups(world, dt);
  updateWanted(world, dt);
  updateMission(world, dt);

  // Health regenerates slowly when the player is out of trouble.
  if (p.hp < TUNING.playerMaxHp && world.wanted < 1) {
    p.hp = Math.min(TUNING.playerMaxHp, p.hp + TUNING.hpRegen * dt);
  }

  // Distances the renderer and the police use.
  for (const car of world.cars) car.dist = Math.hypot(car.x - p.x, car.y - p.y);
  for (const o of world.police) o.dist = Math.hypot(o.x - p.x, o.y - p.y);
  for (const c of world.policeCars) c.dist = Math.hypot(c.x - p.x, c.y - p.y);

  if (p.hp <= 0 && world.mode === 'play') {
    world.mode = 'wasted';
    world.deathT = 0;
  }
}

function updateOnFoot(world, input, dt) {
  const p = world.player;
  const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  if (len > 0) {
    const speed = input.handbrake ? TUNING.runSpeed : TUNING.walkSpeed;
    p.x += (mx / len) * speed * dt;
    p.y += (my / len) * speed * dt;
    p.angle = Math.atan2(my, mx);
    resolveCircle(world.city, p, 14);
  }
  // Aim follows the mouse in world space.
  if (input.aimX != null && input.aimY != null) {
    p.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  }
}

function updateDriving(world, input, dt) {
  const p = world.player;
  const car = world.cars.find((c) => c.id === p.carId);
  if (!car) {
    p.inCar = false;
    p.carId = null;
    return;
  }
  const accel = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const speedRatio = clamp(Math.abs(car.speed) / TUNING.carMaxSpeed, 0, 1);
  if (accel > 0) car.speed += TUNING.carAccel * dt;
  else if (accel < 0) car.speed -= (car.speed > 0 ? TUNING.carBrake : TUNING.carAccel * 0.7) * dt;
  else car.speed *= Math.pow(0.4, dt);
  car.speed = clamp(car.speed, -TUNING.carReverseMax, TUNING.carMaxSpeed);
  const grip = input.handbrake ? TUNING.handbrakeGrip : TUNING.carGrip;
  car.angle += steer * TUNING.carTurn * (0.35 + 0.65 * speedRatio) * Math.sign(car.speed || 1) * dt * (input.handbrake ? 1.5 : 1);
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  car.x += fx * car.speed * dt;
  car.y += fy * car.speed * dt;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  world.stats.distanceDriven += Math.abs(car.speed) * dt;

  // Collisions with buildings: scrape, spark, slow down, damage.
  const before = { x: car.x, y: car.y };
  if (resolveCircle(world.city, car, 26)) {
    const impact = Math.abs(car.speed);
    car.speed *= 0.45;
    if (impact > 180) {
      damageCar(world, car, impact * 0.02);
      spawnSparks(world, before.x, before.y, 6);
      world.audioEvent = 'crash';
    }
  }
  // Collisions with other cars.
  for (const other of world.cars) {
    if (other === car || other.wrecked) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 52 && d > 0.01) {
      // A ramming police car shoves the player less than a traffic car does:
      // the ram itself is the police move, not a constant shove.
      const playerShare = other.kind === 'police' ? 0.25 : 0.5;
      const nx = (other.x - car.x) / d;
      const ny = (other.y - car.y) / d;
      other.x += nx * (52 - d) * (1 - playerShare);
      other.y += ny * (52 - d) * (1 - playerShare);
      car.x -= nx * (52 - d) * playerShare;
      car.y -= ny * (52 - d) * playerShare;
      const impact = Math.abs(car.speed - (other.speed || 0));
      if (impact > 120) {
        damageCar(world, car, impact * 0.015);
        damageCar(world, other, impact * 0.015);
        spawnSparks(world, (car.x + other.x) / 2, (car.y + other.y) / 2, 5);
        world.audioEvent = 'crash';
      }
      car.speed *= 0.8;
      if (other.traffic) other.speed *= 0.5;
    }
  }
  // Running over a pedestrian.
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 34 && Math.abs(car.speed) > 90) {
      ped.state = 'down';
      ped.downT = 4;
      ped.fx = ped.x + (ped.x - car.x);
      ped.fy = ped.y + (ped.y - car.y);
      world.stats.pedsHit += 1;
      addHeat(world, TUNING.pedHitHeat);
      spawnSparks(world, ped.x, ped.y, 8);
      world.audioEvent = 'thud';
      scareNearby(world, ped.x, ped.y, 320);
    }
  }
  if (car.wrecked) {
    exitCar(world);
    world.banner = { text: 'CAR WRECKED', sub: 'That one is finished', t: 2.5 };
  }
}

function damageCar(world, car, amount) {
  car.hp -= amount;
  if (car.hp <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.speed = 0;
    spawnSmoke(world, car.x, car.y, 14);
    if (car.driver === 'ped') {
      car.driver = 'none';
      const ped = {
        id: nextId++, x: car.x + 40, y: car.y + 30, angle: 0,
        speed: TUNING.pedFleeSpeed, color: '#e74c3c', state: 'flee',
        axis: 'v', dir: 1, fleeT: 4, downT: 0, courier: false, fx: car.x + 200, fy: car.y + 200,
      };
      world.peds.push(ped);
    }
  }
}

function fireShot(world, input) {
  const p = world.player;
  if (p.mag <= 0) {
    world.audioEvent = 'dryfire';
    world.shotCooldown = 0.25;
    return;
  }
  p.mag -= 1;
  world.stats.shotsFired += 1;
  world.shotCooldown = TUNING.shotCooldown;
  const ang = p.aimAngle ?? p.angle;
  const ox = p.x + Math.cos(ang) * 22;
  const oy = p.y + Math.sin(ang) * 22;
  world.bullets.push({
    x: ox, y: oy,
    vx: Math.cos(ang) * TUNING.bulletSpeed,
    vy: Math.sin(ang) * TUNING.bulletSpeed,
    life: TUNING.bulletRange / TUNING.bulletSpeed,
  });
  world.muzzle = { x: ox, y: oy, t: 0.06 };
  addHeat(world, TUNING.shotHeat);
  world.audioEvent = 'shot';
  scareNearby(world, p.x, p.y, 420);
}

function updateBullets(world, dt) {
  for (const b of world.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (world.city && b.x > SEA_X) b.life = 0;
  }
  world.bullets = world.bullets.filter((b) => {
    if (b.life <= 0) return false;
    if (world.city.buildings.some((bb) => b.x >= bb.x && b.x <= bb.x + bb.w && b.y >= bb.y && b.y <= bb.y + bb.h)) {
      spawnSparks(world, b.x, b.y, 3);
      return false;
    }
    for (const ped of world.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
        ped.state = 'down';
        ped.downT = 5;
        world.stats.pedsHit += 1;
        addHeat(world, TUNING.pedHitHeat);
        scareNearby(world, ped.x, ped.y, 300);
        return false;
      }
    }
    for (const o of world.police) {
      if (o.hp > 0 && Math.hypot(o.x - b.x, o.y - b.y) < 16) {
        o.hp -= 34;
        addHeat(world, TUNING.copHarmHeat);
        spawnSparks(world, b.x, b.y, 4);
        if (o.hp <= 0) o.downT = 9999;
        return false;
      }
    }
    for (const car of world.cars) {
      if (car.wrecked) continue;
      if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
        damageCar(world, car, 20);
        spawnSparks(world, b.x, b.y, 3);
        return false;
      }
    }
    return true;
  });
}

function updateTraffic(world, dt) {
  const p = world.player;
  for (const car of world.cars) {
    if (!car.traffic || car.wrecked) continue;
    const t = car.traffic;
    // Slow for a car ahead on the same road.
    let blocked = false;
    for (const other of world.cars) {
      if (other === car || other.wrecked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 90 && side < 30) {
        blocked = true;
        break;
      }
    }
    const target = blocked ? 0 : TUNING.trafficSpeed;
    car.speed += clamp(target - car.speed, -300 * dt, 200 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // At a junction, sometimes turn onto the crossing road.
    for (const c of world.city.crossings) {
      if (Math.abs(car.x - c.x) < 8 && Math.abs(car.y - c.y) < 8 && world.rng.chance(0.02)) {
        const turn = world.rng.chance(0.5) ? 1 : -1;
        if (t.axis === 'v') {
          t.axis = 'h';
          t.dir = turn;
          car.angle = turn > 0 ? 0 : Math.PI;
          car.y = c.y + (turn > 0 ? -14 : 14);
        } else {
          t.axis = 'v';
          t.dir = turn;
          car.angle = turn > 0 ? Math.PI / 2 : -Math.PI / 2;
          car.x = c.x + (turn > 0 ? -14 : 14);
        }
        break;
      }
    }
    // Wrap around the far edge so traffic never runs out.
    if (car.x < 20 || car.x > SEA_X - 20 || car.y < 20 || car.y > WORLD_H - 20) {
      const np = randomRoadPoint(world.city, world.rng, p);
      car.x = np.x;
      car.y = np.y;
      car.angle = np.axis === 'v' ? Math.PI / 2 : 0;
      car.traffic = { axis: np.axis, dir: 1 };
    }
    resolveCircle(world.city, car, 24);
  }
}

function updatePeds(world, dt) {
  for (const ped of world.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) {
        ped.state = 'flee';
        ped.fleeT = 3;
        ped.fx = ped.x + 300;
        ped.fy = ped.y - 200;
      }
      continue;
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const ang = Math.atan2(ped.fy - ped.y, ped.fx - ped.x);
      ped.x += Math.cos(ang) * TUNING.pedFleeSpeed * dt;
      ped.y += Math.sin(ang) * TUNING.pedFleeSpeed * dt;
      ped.angle = ang;
      resolveCircle(world.city, ped, 12);
      if (ped.fleeT <= 0) ped.state = 'walk';
      continue;
    }
    // Walking the sidewalk: drift along the road edge, turn at junctions.
    const speed = ped.speed;
    if (ped.axis === 'v') {
      ped.y += ped.dir * speed * dt;
      if (world.rng.chance(0.002)) ped.dir *= -1;
      if (ped.y < 60 || ped.y > WORLD_H - 60) ped.dir *= -1;
    } else {
      ped.x += ped.dir * speed * dt;
      if (world.rng.chance(0.002)) ped.dir *= -1;
      if (ped.x < 60 || ped.x > SEA_X - 60) ped.dir *= -1;
    }
    ped.angle = ped.axis === 'v' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
    // A courier keeps moving; everyone else occasionally crosses at a junction.
    if (!ped.courier) {
      for (const c of world.city.crossings) {
        if (Math.abs(ped.x - c.x) < 10 && Math.abs(ped.y - c.y) < 10 && world.rng.chance(0.01)) {
          ped.axis = ped.axis === 'v' ? 'h' : 'v';
          ped.dir = world.rng.chance(0.5) ? 1 : -1;
          break;
        }
      }
    }
  }
}

function scareNearby(world, x, y, radius) {
  for (const ped of world.peds) {
    if (ped.state === 'walk' && Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.state = 'flee';
      ped.fleeT = 3;
      const ang = Math.atan2(ped.y - y, ped.x - x);
      ped.fx = ped.x + Math.cos(ang) * 400;
      ped.fy = ped.y + Math.sin(ang) * 400;
    }
  }
}

function updatePolice(world, dt) {
  const p = world.player;
  const wanted = Math.round(world.wanted);
  const wantOfficers = wanted >= 1 ? Math.min(2, wanted) : 0;
  const wantCars = wanted >= 2 ? Math.min(4, wanted - 1) : 0;

  while (world.police.filter((o) => o.hp > 0).length < wantOfficers) {
    const spot = randomRoadPoint(world.city, world.rng, p);
    world.police.push({ id: nextId++, x: spot.x, y: spot.y, angle: 0, hp: 100, dist: 9999, arrestT: 0, downT: 0 });
  }
  while (world.policeCars.filter((c) => !c.wrecked).length < wantCars) {
    const spot = randomRoadPoint(world.city, world.rng, p);
    const model = CAR_MODELS[1];
    const car = {
      id: nextId++, x: spot.x, y: spot.y, angle: 0, speed: 0,
      color: '#1c2733', model, kind: 'police', parked: false, hp: 140,
      driver: 'police', traffic: null, dist: 9999, wrecked: false,
    };
    world.cars.push(car);
    world.policeCars.push(car);
  }
  // Trim the response when the heat dies down.
  if (world.wanted < 1) {
    world.police = world.police.filter((o) => o.dist < 900);
    world.policeCars = world.policeCars.filter((c) => !c.wrecked && c.dist < 1200);
  }

  for (const o of world.police) {
    if (o.hp <= 0) continue;
    const d = Math.hypot(p.x - o.x, p.y - o.y);
    o.dist = d;
    // An officer who cannot see the player for a while gives up and leaves.
    if (d > 600) {
      o.loseT = (o.loseT || 0) + dt;
      if (o.loseT > 8) {
        o.hp = 0;
        o.gaveUp = true;
        continue;
      }
    } else {
      o.loseT = 0;
    }
    if (d < 700) {
      const ang = angleTo(o.x, o.y, p.x, p.y);
      o.angle = ang;
      o.x += Math.cos(ang) * TUNING.officerSpeed * dt;
      o.y += Math.sin(ang) * TUNING.officerSpeed * dt;
      resolveCircle(world.city, o, 14);
      if (d < 34 && !p.inCar) {
        o.arrestT += dt;
        if (o.arrestT > 0.7 && world.mode === 'play') {
          world.mode = 'busted';
          world.bustT = 0;
        }
      } else {
        o.arrestT = 0;
      }
    }
  }

  for (const car of world.policeCars) {
    if (car.wrecked) continue;
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    car.dist = d;
    if (car.ramT > 0) car.ramT -= dt;
    // A police car that loses sight of the player for a while gives up the
    // chase and goes back to patrol, so a getaway is actually possible.
    if (d > 700) {
      car.loseT = (car.loseT || 0) + dt;
      if (car.loseT > 6) {
        car.kind = 'civil';
        car.driver = 'ped';
        car.traffic = { axis: 'v', dir: 1 };
        car.color = '#7d8a99';
        car.gaveUp = true;
        continue;
      }
    } else {
      car.loseT = 0;
    }
    if (d < 1100) {
      const want = angleTo(car.x, car.y, p.x, p.y);
      const diff = angleDiff(car.angle, want);
      car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      // After a ram the police car falls back before its next run, so it
      // cannot sit on the player's bumper shoving them around.
      const target = car.ramT > 0
        ? 120
        : Math.min(TUNING.policeCarSpeed, 220 + d * 0.55);
      car.speed += clamp(target - car.speed, -500 * dt, 320 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (resolveCircle(world.city, car, 26)) {
        car.speed *= 0.5;
      }
      // Ramming the player: a hard hit damages the player's car, but a
      // sustained shove is one hit per half second, not a melt.
      if (d < 46) {
        if (p.inCar) {
          const pc = world.cars.find((c) => c.id === p.carId);
          if (pc) {
            const relSpeed = Math.abs(car.speed - pc.speed);
            if (relSpeed > 120 && world.time - (car.lastRamT || 0) > 0.5) {
              car.lastRamT = world.time;
              car.ramT = 1.2;
              damageCar(world, pc, 6);
              world.audioEvent = 'crash';
            }
            pc.speed *= 0.96;
          }
        } else {
          p.hp -= 18 * dt;
          const push = angleTo(car.x, car.y, p.x, p.y);
          p.x += Math.cos(push) * 120 * dt;
          p.y += Math.sin(push) * 120 * dt;
        }
        world.audioEvent = 'crash';
      }
    }
  }
  world.police = world.police.filter((o) => !o.gaveUp);
  world.policeCars = world.policeCars.filter((c) => !c.gaveUp && (!c.wrecked || c.dist < 1400));
}

function updateParticles(world, dt) {
  for (const pt of world.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  world.particles = world.particles.filter((pt) => pt.life > 0);
  if (world.muzzle) {
    world.muzzle.t -= dt;
    if (world.muzzle.t <= 0) world.muzzle = null;
  }
}

function updatePickups(world, dt) {
  world.pickupTimer -= dt;
  const p = world.player;
  for (const pk of world.pickups) {
    pk.bob += dt;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 34) {
      if (pk.kind === 'health') {
        p.hp = Math.min(TUNING.playerMaxHp, p.hp + 50);
        world.banner = { text: 'HEALTH +50', sub: '', t: 1.5 };
      } else {
        p.reserve += 24;
        world.banner = { text: 'AMMO +24', sub: '', t: 1.5 };
      }
      world.audioEvent = 'pickup';
      pk.x = -9999;
      pk.y = -9999;
      world.pickupTimer = TUNING.pickupRespawn;
    }
  }
  if (world.pickupTimer <= 0) {
    const gone = world.pickups.filter((pk) => pk.x < 0);
    if (gone.length > 0) {
      const spot = PICKUP_SPOTS[Math.floor(world.rng.next() * PICKUP_SPOTS.length)];
      const pk = gone[0];
      pk.x = spot.x;
      pk.y = spot.y;
      pk.kind = spot.kind;
    }
    world.pickupTimer = TUNING.pickupRespawn;
  }
}

function updateWanted(world, dt) {
  if (world.wanted > 0) {
    world.crimeTimer += dt;
    const policeNear = world.police.some((o) => o.dist < 500) || world.policeCars.some((c) => c.dist < 500);
    if (!policeNear && world.crimeTimer > TUNING.wantedDecaySeconds) {
      world.wanted = Math.max(0, world.wanted - 1);
      world.crimeTimer = 0;
      if (world.wanted === 0) world.banner = { text: 'HEAT OFF', sub: 'You slipped away clean', t: 2.5 };
    }
  }
}

function spawnSparks(world, x, y, n) {
  for (let i = 0; i < n; i++) {
    world.particles.push({
      x, y,
      vx: world.rng.range(-160, 160), vy: world.rng.range(-160, 160),
      life: world.rng.range(0.2, 0.5), maxLife: 0.5, color: '#ffd23f', size: 3,
    });
  }
}

function spawnSmoke(world, x, y, n) {
  for (let i = 0; i < n; i++) {
    world.particles.push({
      x: x + world.rng.range(-20, 20), y: y + world.rng.range(-20, 20),
      vx: world.rng.range(-20, 20), vy: world.rng.range(-60, -20),
      life: world.rng.range(0.8, 1.6), maxLife: 1.6, color: '#888888', size: 8,
    });
  }
}

// Mission staging: each job prepares the world it needs when it starts.
export function stageMissionWorld(world, def) {
  const p = world.player;
  if (def.id === 'hot-wheels') {
    // A sun-yellow coupe parked by the old cinema.
    const car = {
      id: nextId++, x: 2160, y: 860, angle: Math.PI / 2, speed: 0,
      color: '#f2c200', model: CAR_MODELS[3], kind: 'target', parked: true,
      hp: 100, driver: 'none', traffic: null, dist: 0, wrecked: false,
    };
    world.cars.push(car);
    world.mission.targetCarId = car.id;
  } else if (def.id === 'corner-the-courier') {
    // The courier walks the Market Quarter sidewalk; the marker follows him.
    const ped = {
      id: nextId++, x: 994, y: 1550, angle: 0, speed: 120,
      color: '#e74c3c', state: 'walk', axis: 'v', dir: 1,
      fleeT: 0, downT: 0, courier: true, fx: 0, fy: 0,
    };
    world.peds.push(ped);
    world.mission.targetPedId = ped.id;
  } else if (def.id === 'long-way-home' || def.id === 'duarte-vault') {
    addHeat(world, def.id === 'duarte-vault' ? 4 : 2);
  }
}
