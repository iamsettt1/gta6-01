// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world, steered by an autopilot that drives the road
// grid like a player would — steal a car, follow intersections toward the
// mission marker, outrun the police — so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { STEP, WORLD } from './config.js';
import { SCREEN_BUSTED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_SECONDS = 24;

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function nearest(list, v) {
  let best = list[0];
  for (const item of list) if (Math.abs(item - v) < Math.abs(best - v)) best = item;
  return best;
}

// An L-shaped route over intersections: along the avenues first, then the
// streets, ending at the target point itself.
function routeWaypoints(fromX, fromY, toX, toY) {
  const points = [];
  let ax = nearest(WORLD.avenues, fromX);
  let sy = nearest(WORLD.streets, fromY);
  const tax = nearest(WORLD.avenues, toX);
  const tsy = nearest(WORLD.streets, toY);
  points.push({ x: ax, y: sy });
  const avenues = [...WORLD.avenues].sort((a, b) => a - b);
  const fromAi = avenues.indexOf(ax);
  const toAi = avenues.indexOf(tax);
  const dirA = toAi > fromAi ? 1 : -1;
  for (let i = fromAi; i !== toAi; i += dirA) {
    ax = avenues[i + dirA];
    points.push({ x: ax, y: sy });
  }
  const streets = [...WORLD.streets].sort((a, b) => a - b);
  const fromSi = streets.indexOf(sy);
  const toSi = streets.indexOf(tsy);
  const dirS = toSi > fromSi ? 1 : -1;
  for (let i = fromSi; i !== toSi; i += dirS) {
    sy = streets[i + dirS];
    points.push({ x: ax, y: sy });
  }
  points.push({ x: toX, y: toY });
  return points;
}

function driveInput(car, wx, wy) {
  const desired = Math.atan2(wy - car.y, wx - car.x);
  const diff = angleDiff(car.angle, desired);
  const d = Math.hypot(wx - car.x, wy - car.y);
  const steer = diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0;
  if (Math.abs(diff) > 1.9) {
    return { mx: -steer, my: 1, run: false, handbrake: false, interact: false, punch: false, shoot: false, reload: false, aimAngle: desired };
  }
  // Slow for the turn: never take a corner at full speed, and brake early when
  // the waypoint is close, so the car stays on the road instead of swinging
  // wide into a building.
  let throttle = -1;
  if (Math.abs(diff) > 0.5) throttle = 0;
  if (d < 200 && Math.abs(car.speed) > 220) throttle = 0.6;
  if (d < 120 && Math.abs(car.speed) > 140) throttle = 0.6;
  return { mx: steer, my: throttle, run: false, handbrake: false, interact: false, punch: false, shoot: false, reload: false, aimAngle: desired };
}

function walkInput(px, py, tx, ty, aim) {
  return { mx: tx - px, my: ty - py, run: true, handbrake: false, interact: false, punch: false, shoot: false, reload: false, aimAngle: aim || 0 };
}

/** The nearest parked or traffic car to the player. */
function nearestStealable(world) {
  const p = world.state.player;
  let best = null;
  let bestD = Infinity;
  for (const car of world.state.cars) {
    if (car.kind === 'police') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return { car: best, dist: bestD };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { mx: 0, my: 0, run: false, handbrake: false, interact: false, punch: false, shoot: false, reload: false, aimAngle: 0 }, true);
    }
    return { screen: SCREEN_TITLE };
  }

  if (name === 'end') {
    // Milo is cornered: four stars, low health, an officer already on him. The
    // autopilot stands still and the real arrest rule does the rest.
    world.startMission('m5');
    state.player.health = 12;
    world.addHeat(75);
    const p = state.player;
    state.officers.push({ x: p.x + 24, y: p.y + 10, angle: 0, health: 50, shootTimer: 2, bustTimer: 0, dead: false });
    const idle = { mx: 0, my: 0, run: false, handbrake: false, interact: false, punch: false, shoot: false, reload: false, aimAngle: 0 };
    for (let i = 0; i < END_SECONDS / STEP; i += 1) {
      world.step(STEP, idle, false);
      if (state.ended) break;
    }
    // The arrest costs Milo the same fine the live game charges, so the Busted
    // panel's numbers agree with the state it shows.
    if (state.ended === 'busted') {
      state.fine = Math.min(200, state.cash);
      state.cash -= state.fine;
    }
    return { screen: state.ended === 'wasted' ? SCREEN_WASTED : SCREEN_BUSTED };
  }

  // Play: start the Getaway Driver mission, steal the nearest car, and drive
  // the road grid to Big T while the police close in. The route is recomputed
  // whenever the mission step changes, and during a chase the autopilot
  // patrols the grid instead of sitting on the pickup point — so the car
  // stays on the roads even after police rams shove it around.
  world.startMission('m3');
  const CHASE_STOPS = [
    { x: 300, y: 250 }, { x: 3300, y: 250 }, { x: 3300, y: 2400 },
    { x: 300, y: 2400 }, { x: 1500, y: 1150 }, { x: 2100, y: 700 },
  ];
  let waypoints = null;
  let wpIndex = 0;
  let routeKey = '';
  let chaseStop = 0;
  let heated = false;
  let stuckSteps = 0;
  let reverseSteps = 0;
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    const p = state.player;
    let input;
    if (!p.inCar) {
      const { car, dist: d } = nearestStealable(world);
      if (!car) break;
      if (d < 50) {
        input = { mx: 0, my: 0, run: false, handbrake: false, interact: true, punch: false, shoot: false, reload: false, aimAngle: 0 };
      } else {
        input = walkInput(p.x, p.y, car.x, car.y, Math.atan2(car.y - p.y, car.x - p.x));
      }
    } else {
      const step = world.currentStep();
      const key = step ? `${world.state.missionStep}:${step.type}:${chaseStop}` : 'none';
      if (key !== routeKey) {
        routeKey = key;
        if (step && step.type === 'chase') {
          const stop = CHASE_STOPS[chaseStop % CHASE_STOPS.length];
          waypoints = routeWaypoints(p.x, p.y, stop.x, stop.y);
        } else if (step && step.x !== undefined) {
          waypoints = routeWaypoints(p.x, p.y, step.x, step.y);
        } else {
          waypoints = routeWaypoints(p.x, p.y, 1500, 1150);
        }
        wpIndex = 0;
      }
      const wp = waypoints[Math.min(wpIndex, waypoints.length - 1)];
      if (Math.hypot(wp.x - p.x, wp.y - p.y) < 80 && wpIndex < waypoints.length - 1) wpIndex += 1;
      if (wpIndex >= waypoints.length - 1 && Math.hypot(wp.x - p.x, wp.y - p.y) < 80) {
        // Reached the end of the route: during a chase, head for the next stop.
        const stepNow = world.currentStep();
        if (stepNow && stepNow.type === 'chase') {
          chaseStop += 1;
          routeKey = '';
        }
      }
      input = driveInput(p.inCar, waypoints[wpIndex].x, waypoints[wpIndex].y);
      // Stuck against something: back up for a moment, then carry on.
      if (Math.abs(p.inCar.speed) < 15) stuckSteps += 1;
      else stuckSteps = 0;
      if (stuckSteps > 90) {
        reverseSteps = 50;
        stuckSteps = 0;
      }
      if (reverseSteps > 0) {
        reverseSteps -= 1;
        input = { mx: -input.mx, my: 1, run: false, handbrake: false, interact: false, punch: false, shoot: false, reload: false, aimAngle: input.aimAngle };
      }
      if (!heated && Math.abs(p.inCar.speed) > 150) {
        // Turn the heat up so the chase is on for the screenshot.
        world.addHeat(38);
        heated = true;
      }
    }
    world.step(STEP, input, false);
    if (state.ended) break;
  }
  return { screen: SCREEN_PLAY };
}
