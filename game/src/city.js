// Solmar Bay's city: five districts on a road grid, buildings with heights and
// colours, parks, the beach and the sea, lamps and palms. Everything is generated
// once from the seed, so the same seed always builds the same city. It also owns
// the geometry questions the rest of the game asks: is this point on a road, does
// this circle hit a building, where is the nearest road or intersection.
import { WORLD } from './config.js';

export const DISTRICTS = [
  { name: 'Old Harbor', x0: 0, y0: 0, x1: 650, y1: 900, tint: '#8a7a5c', blurb: 'cranes, crates and salt air' },
  { name: 'Marina Heights', x0: 2350, y0: 0, x1: 3600, y1: 900, tint: '#7fa8c9', blurb: 'glass towers over the bay' },
  { name: 'Neon Mile', x0: 650, y0: 900, x1: 2350, y1: 1750, tint: '#c98ab8', blurb: 'clubs, diners and bright signs' },
  { name: 'Palm Row', x0: 650, y0: 1750, x1: 2350, y1: 2450, tint: '#8fbf7a', blurb: 'bungalows under the palms' },
  { name: 'Industrial Flats', x0: 2350, y0: 1750, x1: 3600, y1: 2450, tint: '#9a8f7a', blurb: 'warehouses and truck yards' },
];

const ROOF_COLORS = ['#b0563f', '#c97e4a', '#7d8aa0', '#5d7a6a', '#a08a5f', '#8a6a8a', '#4f6a8a', '#c9b458'];
const WALL_COLORS = ['#e8d9b8', '#d9c9a8', '#c9b8a0', '#e0c9c0', '#b8c9d9', '#d9d9c9'];

function nearestValue(list, v) {
  let best = list[0];
  for (const item of list) if (Math.abs(item - v) < Math.abs(best - v)) best = item;
  return best;
}

export function createCity(random) {
  const buildings = [];
  const props = []; // lamps, palms, benches, crates — drawn as small markers
  const parks = [];

  // One building per block cell, jittered inside its block, with a height tier by
  // district: towers in Marina Heights, low houses in Palm Row.
  for (let ai = 0; ai < WORLD.avenues.length - 1; ai += 1) {
    for (let si = 0; si < WORLD.streets.length - 1; si += 1) {
      const x0 = WORLD.avenues[ai] + WORLD.roadWidth / 2 + 14;
      const x1 = WORLD.avenues[ai + 1] - WORLD.roadWidth / 2 - 14;
      const y0 = WORLD.streets[si] + WORLD.roadWidth / 2 + 14;
      const y1 = WORLD.streets[si + 1] - WORLD.roadWidth / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = DISTRICTS.find((d) => cx >= d.x0 && cx < d.x1 && cy >= d.y0 && cy < d.y1);
      const isPark = random() < 0.14;
      if (isPark) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let p = 0; p < 7; p += 1) {
          props.push({ kind: 'palm', x: random.range(x0 + 20, x1 - 20), y: random.range(y0 + 20, y1 - 20) });
        }
        props.push({ kind: 'bench', x: cx, y: cy });
        continue;
      }
      const tall = district && district.name === 'Marina Heights';
      const low = district && district.name === 'Palm Row';
      const w = random.range(110, Math.min(280, x1 - x0 - 20));
      const h = random.range(100, Math.min(240, y1 - y0 - 20));
      const bx = random.range(x0, x1 - w);
      const by = random.range(y0, y1 - h);
      buildings.push({
        x: bx, y: by, w, h,
        height: tall ? random.int(3, 6) : low ? 1 : random.int(1, 3),
        roof: random.pick(ROOF_COLORS),
        wall: random.pick(WALL_COLORS),
        district: district ? district.name : 'Solmar Bay',
      });
      // A second smaller building in big blocks.
      if ((x1 - x0) > 380 && random() < 0.6) {
        const w2 = random.range(70, 130);
        const h2 = random.range(60, 110);
        buildings.push({
          x: random.range(x0, x1 - w2), y: random.range(y0, y1 - h2), w: w2, h: h2,
          height: 1, roof: random.pick(ROOF_COLORS), wall: random.pick(WALL_COLORS),
          district: district ? district.name : 'Solmar Bay',
        });
      }
    }
  }

  // Street lamps along every avenue and street, palms along the beach road.
  for (const ax of WORLD.avenues) {
    for (const sy of WORLD.streets) {
      props.push({ kind: 'lamp', x: ax + WORLD.roadWidth / 2 + 8, y: sy - WORLD.roadWidth / 2 - 8 });
    }
  }
  for (let x = 200; x < WORLD.width; x += 260) {
    props.push({ kind: 'palm', x, y: WORLD.beachTop - 30 });
    props.push({ kind: 'palm', x: x + 130, y: WORLD.beachTop + 40 });
  }
  // Crates stacked near the harbor docks.
  for (let i = 0; i < 14; i += 1) {
    props.push({ kind: 'crate', x: random.range(60, 560), y: random.range(80, 820) });
  }

  function onRoad(x, y) {
    for (const ax of WORLD.avenues) if (Math.abs(x - ax) < WORLD.roadWidth / 2) return true;
    for (const sy of WORLD.streets) if (Math.abs(y - sy) < WORLD.roadWidth / 2) return true;
    return false;
  }

  function districtAt(x, y) {
    for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
    if (y >= WORLD.beachTop) return { name: 'Sunset Beach', x0: 0, y0: WORLD.beachTop, x1: WORLD.width, y1: WORLD.height, tint: '#e8c98a', blurb: 'sand, surf and food trucks' };
    return { name: 'Solmar Bay', x0: 0, y0: 0, x1: WORLD.width, y1: WORLD.height, tint: '#888888', blurb: '' };
  }

  // Push a circle out of every building it overlaps; returns true when it moved.
  function resolveCircle(body) {
    let hit = false;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
      const dx = body.x - cx;
      const dy = body.y - cy;
      const d2 = dx * dx + dy * dy;
      const r = body.radius;
      if (d2 < r * r) {
        hit = true;
        const d = Math.sqrt(d2) || 0.001;
        if (d2 < 0.01) {
          // Centre inside the building: push out along the shortest side.
          const left = body.x - b.x;
          const right = b.x + b.w - body.x;
          const top = body.y - b.y;
          const bottom = b.y + b.h - body.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) body.x = b.x - r;
          else if (m === right) body.x = b.x + b.w + r;
          else if (m === top) body.y = b.y - r;
          else body.y = b.y + b.h + r;
        } else {
          body.x = cx + (dx / d) * r;
          body.y = cy + (dy / d) * r;
        }
      }
    }
    return hit;
  }

  function nearestRoadPoint(x, y) {
    const ax = nearestValue(WORLD.avenues, x);
    const sy = nearestValue(WORLD.streets, y);
    // The closer of the nearest avenue / street centreline.
    return Math.abs(x - ax) < Math.abs(y - sy) ? { x: ax, y, vertical: true } : { x, y: sy, vertical: false };
  }

  function nearestIntersection(x, y) {
    return { x: nearestValue(WORLD.avenues, x), y: nearestValue(WORLD.streets, y) };
  }

  return { buildings, props, parks, onRoad, districtAt, resolveCircle, nearestRoadPoint, nearestIntersection };
}
