// Solmar Bay's layout: a road grid, five districts, buildings packed into the
// blocks between roads, parks, a beach and the sea on the east edge. The builder
// is deterministic for a seed, and it also answers the questions the rules need:
// is a point on a road, does a circle hit a building, where can a car park.

import { WORLD_W, WORLD_H, ROAD_W, ROADS_V, ROADS_H, SEA_X, BEACH_X, DISTRICTS, PALETTE } from './config.js';
import { makeRng, clamp } from './random.js';

const BLOCK_PAD = ROAD_W / 2 + 18;

export function buildCity(seed) {
  const rng = makeRng(seed);
  const city = {
    seed,
    w: WORLD_W,
    h: WORLD_H,
    buildings: [],
    parks: [],
    trees: [],
    lamps: [],
    benches: [],
    hydrants: [],
    crossings: [],
  };

  // Every crossing of a vertical and a horizontal road is a junction where
  // pedestrians cross and traffic may turn.
  for (const vx of ROADS_V) {
    for (const hy of ROADS_H) {
      city.crossings.push({ x: vx, y: hy });
    }
  }

  // Blocks are the rectangles between neighbouring roads. A few become parks;
  // the rest get one to four buildings, kept clear of the beach strip.
  const xs = [0, ...ROADS_V, WORLD_W];
  const ys = [0, ...ROADS_H, WORLD_H];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + (bi === 0 ? 24 : BLOCK_PAD);
      const x1 = xs[bi + 1] - (bi === xs.length - 2 ? 24 : BLOCK_PAD);
      const y0 = ys[bj] + (bj === 0 ? 24 : BLOCK_PAD);
      const y1 = ys[bj + 1] - (bj === ys.length - 2 ? 24 : BLOCK_PAD);
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 90 || bh < 90) continue;
      if (x0 >= BEACH_X - 40) continue; // the beachfront stays open sand
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const downtown = cx > 1400 && cx < 2800 && cy < 1400;
      if (rng.chance(downtown ? 0.1 : 0.22)) {
        makePark(city, rng, x0, y0, x1, y1);
        continue;
      }
      makeBlockBuildings(city, rng, x0, y0, x1, y1, downtown);
    }
  }

  // Street props: lamps along every road, trees on sidewalks, hydrants near
  // junctions, benches in the parks.
  for (const vx of ROADS_V) {
    for (let y = 60; y < WORLD_H; y += 260) {
      city.lamps.push({ x: vx + ROAD_W / 2 + 8, y });
      city.lamps.push({ x: vx - ROAD_W / 2 - 8, y: y + 130 });
    }
  }
  for (const hy of ROADS_H) {
    for (let x = 60; x < WORLD_W - 300; x += 260) {
      city.lamps.push({ x, y: hy + ROAD_W / 2 + 8 });
    }
  }
  for (const c of city.crossings) {
    if (rng.chance(0.6)) city.hydrants.push({ x: c.x + ROAD_W / 2 + 14, y: c.y + ROAD_W / 2 + 14 });
  }
  for (let i = 0; i < 90; i++) {
    const vx = ROADS_V[Math.floor(rng.next() * ROADS_V.length)];
    const side = rng.chance(0.5) ? 1 : -1;
    city.trees.push({
      x: vx + side * (ROAD_W / 2 + 16),
      y: rng.range(40, WORLD_H - 40),
    });
  }
  return city;
}

function makePark(city, rng, x0, y0, x1, y1) {
  const park = { x0, y0, x1, y1, trees: [] };
  const n = Math.floor(rng.range(5, 10));
  for (let i = 0; i < n; i++) {
    const t = { x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20) };
    park.trees.push(t);
    city.trees.push(t);
  }
  for (let i = 0; i < 3; i++) {
    city.benches.push({ x: rng.range(x0 + 30, x1 - 30), y: rng.range(y0 + 30, y1 - 30), angle: rng.range(0, Math.PI) });
  }
  city.parks.push(park);
}

function makeBlockBuildings(city, rng, x0, y0, x1, y1, downtown) {
  const cols = rng.int(1, 2);
  const rows = rng.int(1, 2);
  const cw = (x1 - x0) / cols;
  const ch = (y1 - y0) / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (rng.chance(0.12)) continue; // an empty lot keeps the city breathing
      const bx0 = x0 + c * cw + 8;
      const by0 = y0 + r * ch + 8;
      const bw = cw * rng.range(0.62, 0.9);
      const bh = ch * rng.range(0.62, 0.9);
      const cx = bx0 + bw / 2;
      const cy = by0 + bh / 2;
      const height = downtown ? rng.int(2, 5) : rng.int(1, 3);
      const hues = ['#b08d6a', '#9a8f7a', '#7d94a8', '#a87f7f', '#8fa08a', '#c2a878', '#6f7f95'];
      city.buildings.push({
        x: bx0,
        y: by0,
        w: bw,
        h: bh,
        cx,
        cy,
        height,
        color: hues[Math.floor(rng.next() * hues.length)],
        roof: rng.next(),
      });
    }
  }
}

// --- Queries the rules and the renderer share ---

export function isOnRoad(city, x, y) {
  const half = ROAD_W / 2;
  for (const vx of ROADS_V) if (Math.abs(x - vx) <= half) return true;
  for (const hy of ROADS_H) if (Math.abs(y - hy) <= half) return true;
  return false;
}

export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of every building it overlaps and out of the sea; returns
// true when anything was pushed (a collision the rules can react to).
export function resolveCircle(city, body, r) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = clamp(body.x, b.x, b.x + b.w);
    const ny = clamp(body.y, b.y, b.y + b.h);
    const dx = body.x - nx;
    const dy = body.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        body.x = nx + (dx / d) * r;
        body.y = ny + (dy / d) * r;
      } else {
        // Centre inside the rectangle: shove out along the shallowest side.
        const left = body.x - b.x;
        const right = b.x + b.w - body.x;
        const top = body.y - b.y;
        const bottom = b.y + b.h - body.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) body.x = b.x - r;
        else if (m === right) body.x = b.x + b.w + r;
        else if (m === top) body.y = b.y - r;
        else body.y = b.y + b.h + r;
      }
    }
  }
  if (body.x > SEA_X - r) {
    body.x = SEA_X - r;
    hit = true;
  }
  if (body.x < r) {
    body.x = r;
    hit = true;
  }
  if (body.y < r) {
    body.y = r;
    hit = true;
  }
  if (body.y > WORLD_H - r) {
    body.y = WORLD_H - r;
    hit = true;
  }
  return hit;
}

// A point on a road near (x, y): the nearest road centreline, clamped into
// the world, for spawning cars and police on the network.
export function nearestRoadPoint(city, x, y) {
  let bestV = ROADS_V[0];
  let bestH = ROADS_H[0];
  for (const vx of ROADS_V) if (Math.abs(vx - x) < Math.abs(bestV - x)) bestV = vx;
  for (const hy of ROADS_H) if (Math.abs(hy - y) < Math.abs(bestH - y)) bestH = hy;
  if (Math.abs(bestV - x) <= Math.abs(bestH - y)) return { x: bestV, y: clamp(y, 40, WORLD_H - 40), axis: 'v' };
  return { x: clamp(x, 40, SEA_X - 80), y: bestH, axis: 'h' };
}

export function randomRoadPoint(city, rng, minDistFrom) {
  for (let tries = 0; tries < 40; tries++) {
    const axis = rng.chance(0.5) ? 'v' : 'h';
    let p;
    if (axis === 'v') {
      p = { x: ROADS_V[Math.floor(rng.next() * ROADS_V.length)], y: rng.range(80, WORLD_H - 80), axis };
    } else {
      p = { x: rng.range(80, SEA_X - 120), y: ROADS_H[Math.floor(rng.next() * ROADS_H.length)], axis };
    }
    if (minDistFrom && Math.hypot(p.x - minDistFrom.x, p.y - minDistFrom.y) < 500) continue;
    return p;
  }
  return { x: ROADS_V[2], y: ROADS_H[2], axis: 'v' };
}
