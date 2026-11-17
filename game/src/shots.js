// Deterministic screenshot scenes: ?shot=start|play|end (with &seed=N).
// Each scene plays the real rules forward from a fresh world with a simple
// autopilot — follow the roads, chase the mission marker — paints twice and
// sets window.__shotReady when it is ready. Nothing here is staged art: the
// car, the police and the wanted stars are all live game state.

import { ROADS_V, ROADS_H } from './config.js';
import { angleDiff, angleTo } from './random.js';
import { nearestRoadPoint } from './city.js';
import { addHeat, update } from './world.js';
import { startMission, missionTarget } from './missions.js';

export function setupShot(world, shot, seed) {
  const p = world.player;
  if (shot === 'start') {
    world.mode = 'title';
    return;
  }
  if (shot === 'end') {
    // Rio got caught outside the Sunrise Cafe: busted, fined, heat gone.
    p.x = 1560;
    p.y = 1240;
    world.cash = 640;
    world.stats.missionsDone = 2;
    world.mode = 'busted';
    return;
  }
  // ?shot=play: a live chase. Rio is driving, the crew's getaway job is on,
  // and the police are closing in.
  world.mode = 'play';
  const chaseScene = seed === 7;
  const spot = chaseScene ? { x: 2100, y: 1300 } : { x: 3060, y: 1300 };
  // Put Rio in a car on the road, already rolling.
  const car = world.cars.find((c) => c.parked && Math.abs(c.x - spot.x) < 900 && Math.abs(c.y - spot.y) < 900)
    || world.cars.find((c) => c.parked);
  if (car) {
    car.x = spot.x;
    car.y = spot.y;
    // Face the first leg of the route, not away from it: north up road 2100
    // for the getaway, west along road 1300 for the delivery drive.
    car.angle = chaseScene ? -Math.PI / 2 : Math.PI;
    car.speed = 240;
    car.parked = false;
    car.traffic = null;
    car.driver = 'player';
    p.inCar = true;
    p.carId = car.id;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    world.lastCarId = car.id;
  }
  if (chaseScene) {
    startMission(world, 2); // The Long Way Home — getaway under pursuit
    addHeat(world, 3);
  } else {
    startMission(world, 0); // First Errand — a delivery drive
    addHeat(world, 2);
  }
  // Step the world forward so the police are already in the frame. The
  // getaway gets a longer run-up; the delivery drive is caught mid-straight.
  stepShotWorld(world, chaseScene ? 240 : 150);
}

export function stepShotWorld(world, frames) {
  for (let i = 0; i < frames; i++) {
    const input = autopilotInput(world);
    update(world, input, 1 / 60);
  }
}

// The autopilot drives like a careful getaway driver: it routes on the road
// grid (junction to junction, never cutting through blocks), slows for sharp
// turns, and aims at the mission marker once the roads bring it close.
export function autopilotInput(world) {
  const p = world.player;
  const input = {
    up: false, down: false, left: false, right: false,
    handbrake: false, enter: false, shoot: false, reload: false,
    aimX: p.x + 200, aimY: p.y,
  };
  const target = missionTarget(world);
  let tx = target ? target.x : 1500;
  let ty = target ? target.y : 1300;

  const car = p.inCar ? world.cars.find((c) => c.id === p.carId) : null;
  const speed = car ? Math.abs(car.speed) : 0;

  // Route on the grid: from the road the car is on, to the junction nearest
  // the target's road, then along that road to the target.
  let wx = tx;
  let wy = ty;
  if (car) {
    const route = routeOnGrid(world, p.x, p.y, tx, ty);
    wx = route.x;
    wy = route.y;
  }
  const distToWaypoint = Math.hypot(wx - p.x, wy - p.y);
  const want = angleTo(p.x, p.y, wx, wy);
  const diff = angleDiff(p.angle, want);

  if (car) {
    // Ease off near a junction so the turn does not overshoot it.
    const targetSpeed = distToWaypoint < 300 ? 150 : 520;
    if (speed < targetSpeed) input.up = true;
    else if (speed > targetSpeed + 60) input.down = true;
    if (diff > 0.12) input.left = true;
    else if (diff < -0.12) input.right = true;
    if (Math.abs(diff) > 0.7 && speed > 160) input.handbrake = true;
    // A building right ahead: lift off and swing around it.
    const aheadX = p.x + Math.cos(p.angle) * 90;
    const aheadY = p.y + Math.sin(p.angle) * 90;
    if (world.city.buildings.some((b) => aheadX >= b.x && aheadX <= b.x + b.w && aheadY >= b.y && aheadY <= b.y + b.h)) {
      input.up = false;
      input.down = true;
      input.left = true;
    }
  } else {
    // On foot: walk straight toward the marker on both axes.
    const dx = tx - p.x;
    const dy = ty - p.y;
    if (dx > 12) input.right = true;
    else if (dx < -12) input.left = true;
    if (dy > 12) input.down = true;
    else if (dy < -12) input.up = true;
  }
  // Aim the pistol at the nearest police car for a lively frame.
  const cop = world.policeCars.find((c) => !c.wrecked);
  if (cop) {
    input.aimX = cop.x;
    input.aimY = cop.y;
  }
  return input;
}

// The next grid waypoint toward (tx, ty): the junction on the car's current
// road that starts the leg toward the target, then the junction on the
// target's road, then the target itself.
function routeOnGrid(world, x, y, tx, ty) {
  const vRoads = ROADS_V;
  const hRoads = ROADS_H;
  let nearestV = vRoads[0];
  for (const vx of vRoads) if (Math.abs(vx - x) < Math.abs(nearestV - x)) nearestV = vx;
  let nearestH = hRoads[0];
  for (const hy of hRoads) if (Math.abs(hy - y) < Math.abs(nearestH - y)) nearestH = hy;
  const onVertical = Math.abs(x - nearestV) < 80;
  const onHorizontal = Math.abs(y - nearestH) < 80;

  let targetV = vRoads[0];
  for (const vx of vRoads) if (Math.abs(vx - tx) < Math.abs(targetV - tx)) targetV = vx;
  let targetH = hRoads[0];
  for (const hy of hRoads) if (Math.abs(hy - ty) < Math.abs(targetH - ty)) targetH = hy;

  if (!onVertical && !onHorizontal) {
    // Off the network (a crash pushed the car out): head for the nearest road.
    const rp = nearestRoadPoint(world.city, x, y);
    return { x: rp.x, y: rp.y };
  }
  if (onVertical) {
    // Drive along this vertical road to the target's horizontal road, then
    // turn onto it toward the target. The leg switches early so the turn
    // starts while the car is still inside the junction square.
    if (Math.abs(y - targetH) > 150) return { x: nearestV, y: targetH };
    if (Math.abs(x - tx) > 150) return { x: tx, y: targetH };
    return { x: tx, y: ty };
  }
  // On a horizontal road: drive to the target's vertical road, then turn.
  if (Math.abs(x - targetV) > 150) return { x: targetV, y: nearestH };
  if (Math.abs(y - ty) > 150) return { x: targetV, y: ty };
  return { x: tx, y: ty };
}
