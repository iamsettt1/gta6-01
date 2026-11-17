// Everything Solmar Bay shows: the city from above, the cars, people and
// police, the HUD with its minimap, and every menu (title, pause, busted,
// wasted, missions) drawn by the game itself on one canvas.

import { WORLD_W, WORLD_H, ROAD_W, ROADS_V, ROADS_H, SEA_X, BEACH_X, VIEW_W, VIEW_H, PALETTE, TUNING, DISTRICTS } from './config.js';
import { clamp } from './random.js';
import { missionTarget, currentObjective, stageTimerText, MISSIONS } from './missions.js';

export function cameraFor(world) {
  const p = world.player;
  const cx = clamp(p.x - VIEW_W / 2, 0, Math.max(0, WORLD_W - VIEW_W));
  const cy = clamp(p.y - VIEW_H / 2, 0, Math.max(0, WORLD_H - VIEW_H));
  return { x: cx, y: cy };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, world, time) {
  const cam = cameraFor(world);
  const x0 = cam.x;
  const y0 = cam.y;
  const x1 = cam.x + VIEW_W;
  const y1 = cam.y + VIEW_H;
  const city = world.city;

  // Ground: grass, then district tints, then beach and sea.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.tint;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(d.x0 - x0, d.y0 - y0, d.x1 - d.x0, d.y1 - d.y0);
    ctx.globalAlpha = 1;
  }
  // Beach sand and the sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(BEACH_X - x0, 0, SEA_X - BEACH_X, VIEW_H);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(SEA_X - x0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = PALETTE.seaDeep;
  for (let wy = 40; wy < WORLD_H; wy += 140) {
    const waveX = SEA_X + 40 + Math.sin(time * 0.8 + wy * 0.05) * 18;
    ctx.fillRect(waveX - x0, wy - y0, 90, 6);
  }
  // District names on the ground.
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const d of DISTRICTS) {
    const cx = (d.x0 + d.x1) / 2;
    const cy = (d.y0 + d.y1) / 2;
    if (cx < x0 - 100 || cx > x1 + 100 || cy < y0 - 100 || cy > y1 + 100) continue;
    ctx.fillStyle = d.label;
    ctx.globalAlpha = 0.5;
    ctx.fillText(d.name.toUpperCase(), cx - x0, cy - y0);
    ctx.globalAlpha = 1;
  }

  drawRoads(ctx, x0, y0, x1, y1);
  drawParks(ctx, city, x0, y0, x1, y1, time);
  drawBuildings(ctx, city, x0, y0, x1, y1);
  drawProps(ctx, city, x0, y0, x1, y1);
  drawPickups(ctx, world, x0, y0);
  drawMissionMarker(ctx, world, x0, y0, time);
  drawCars(ctx, world, x0, y0, time);
  drawPeds(ctx, world, x0, y0, time);
  drawOfficers(ctx, world, x0, y0, time);
  drawPlayer(ctx, world, x0, y0, time);
  drawBullets(ctx, world, x0, y0);
  drawParticles(ctx, world, x0, y0);
}

function drawRoads(ctx, x0, y0, x1, y1) {
  ctx.fillStyle = PALETTE.sidewalk;
  for (const vx of ROADS_V) ctx.fillRect(vx - ROAD_W / 2 - 8 - x0, 0, ROAD_W + 16, VIEW_H);
  for (const hy of ROADS_H) ctx.fillRect(0, hy - ROAD_W / 2 - 8 - y0, VIEW_W, ROAD_W + 16);
  ctx.fillStyle = PALETTE.road;
  for (const vx of ROADS_V) ctx.fillRect(vx - ROAD_W / 2 - x0, 0, ROAD_W, VIEW_H);
  for (const hy of ROADS_H) ctx.fillRect(0, hy - ROAD_W / 2 - y0, VIEW_W, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const vx of ROADS_V) {
    for (let y = 0; y < WORLD_H; y += 70) {
      if (y < y0 - 40 || y > y1 + 40) continue;
      ctx.fillRect(vx - 3 - x0, y - y0, 6, 34);
    }
  }
  for (const hy of ROADS_H) {
    for (let x = 0; x < WORLD_W; x += 70) {
      if (x < x0 - 40 || x > x1 + 40) continue;
      ctx.fillRect(x - x0, hy - 3 - y0, 34, 6);
    }
  }
  // Crosswalk stripes at junctions.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const vx of ROADS_V) {
    for (const hy of ROADS_H) {
      if (vx < x0 - 120 || vx > x1 + 120 || hy < y0 - 120 || hy > y1 + 120) continue;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(vx + i * 16 - 5 - x0, hy - ROAD_W / 2 - 4 - y0, 10, 14);
        ctx.fillRect(vx + i * 16 - 5 - x0, hy + ROAD_W / 2 - 10 - y0, 10, 14);
      }
    }
  }
}

function drawParks(ctx, city, x0, y0, x1, y1, time) {
  for (const park of city.parks) {
    if (park.x1 < x0 || park.x0 > x1 || park.y1 < y0 || park.y0 > y1) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x0 - x0, park.y0 - y0, park.x1 - park.x0, park.y1 - park.y0);
    ctx.strokeStyle = '#3f7a33';
    ctx.lineWidth = 3;
    ctx.strokeRect(park.x0 - x0, park.y0 - y0, park.x1 - park.x0, park.y1 - park.y0);
  }
}

function drawBuildings(ctx, city, x0, y0, x1, y1) {
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    const bx = b.x - x0;
    const by = b.y - y0;
    // Drop shadow for height.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(bx + 6, by + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(bx, by, b.w, b.h);
    // Roof inset and details: skylights and AC units.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(bx + 6, by + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    const units = Math.max(1, Math.floor((b.w * b.h) / 9000));
    for (let i = 0; i < units; i++) {
      const ux = bx + 12 + ((i * 37 + b.roof * 91) % Math.max(10, b.w - 30));
      const uy = by + 12 + ((i * 53 + b.roof * 57) % Math.max(10, b.h - 30));
      ctx.fillRect(ux, uy, 12, 9);
    }
    // Height ticks on the south face.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let h = 0; h < b.height; h++) {
      ctx.fillRect(bx + 8 + h * 14, by + b.h - 5, 10, 3);
    }
  }
}

function drawProps(ctx, city, x0, y0, x1, y1) {
  for (const t of city.trees) {
    if (t.x < x0 - 30 || t.x > x1 + 30 || t.y < y0 - 30 || t.y > y1 + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(t.x + 3 - x0, t.y + 4 - y0, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f6b2a';
    ctx.beginPath();
    ctx.arc(t.x - x0, t.y - y0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4c8a3f';
    ctx.beginPath();
    ctx.arc(t.x - 3 - x0, t.y - 3 - y0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const lamp of city.lamps) {
    if (lamp.x < x0 - 10 || lamp.x > x1 + 10 || lamp.y < y0 - 10 || lamp.y > y1 + 10) continue;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lamp.x - x0, lamp.y - y0);
    ctx.lineTo(lamp.x - x0, lamp.y - 16 - y0);
    ctx.stroke();
    ctx.fillStyle = '#ffe9a3';
    ctx.beginPath();
    ctx.arc(lamp.x - x0, lamp.y - 18 - y0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const h of city.hydrants) {
    if (h.x < x0 - 10 || h.x > x1 + 10 || h.y < y0 - 10 || h.y > y1 + 10) continue;
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(h.x - 4 - x0, h.y - 6 - y0, 8, 12);
  }
  for (const bench of city.benches) {
    if (bench.x < x0 - 20 || bench.x > x1 + 20 || bench.y < y0 - 20 || bench.y > y1 + 20) continue;
    ctx.save();
    ctx.translate(bench.x - x0, bench.y - y0);
    ctx.rotate(bench.angle);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-14, -4, 28, 8);
    ctx.restore();
  }
}

function drawPickups(ctx, world, x0, y0) {
  for (const pk of world.pickups) {
    if (pk.x < 0) continue;
    const bob = Math.sin(pk.bob * 3) * 3;
    const sx = pk.x - x0;
    const sy = pk.y - y0 + bob;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(sx, pk.y - y0 + 10, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (pk.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 12, sy - 12, 24, 24);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(sx - 3, sy - 9, 6, 18);
      ctx.fillRect(sx - 9, sy - 3, 18, 6);
    } else {
      ctx.fillStyle = '#f2c200';
      ctx.fillRect(sx - 12, sy - 10, 24, 20);
      ctx.fillStyle = '#222';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', sx, sy + 4);
    }
  }
}

function drawMissionMarker(ctx, world, x0, y0, time) {
  const target = missionTarget(world);
  if (!target) return;
  const pulse = 1 + Math.sin(time * 5) * 0.15;
  const sx = target.x - x0;
  const sy = target.y - y0;
  const onScreen = sx > -40 && sx < VIEW_W + 40 && sy > -40 && sy < VIEW_H + 40;
  if (onScreen) {
    ctx.strokeStyle = 'rgba(255,215,0,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,0,0.25)';
    ctx.beginPath();
    ctx.arc(sx, sy, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Beacon column.
    const grad = ctx.createLinearGradient(sx, sy - 160, sx, sy);
    grad.addColorStop(0, 'rgba(255,215,0,0)');
    grad.addColorStop(1, 'rgba(255,215,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - 8, sy - 160, 16, 160);
  } else {
    // Edge arrow pointing at the off-screen objective.
    const cx = clamp(sx, 40, VIEW_W - 40);
    const cy = clamp(sy, 40, VIEW_H - 40);
    const ang = Math.atan2(sy - VIEW_H / 2, sx - VIEW_W / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawCarShape(ctx, x, y, angle, model, color, kind, time, wrecked) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const len = model.len;
  const wid = model.wid;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -len / 2 + 3, -wid / 2 + 4, len, wid, 8);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#111';
  ctx.fillRect(-len / 2 + 6, -wid / 2 - 3, 12, 6);
  ctx.fillRect(len / 2 - 18, -wid / 2 - 3, 12, 6);
  ctx.fillRect(-len / 2 + 6, wid / 2 - 3, 12, 6);
  ctx.fillRect(len / 2 - 18, wid / 2 - 3, 12, 6);
  // Body.
  ctx.fillStyle = wrecked ? '#555' : color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 8);
  ctx.fill();
  // Cabin / windshield.
  ctx.fillStyle = wrecked ? '#333' : 'rgba(20,30,45,0.85)';
  roundRect(ctx, -len * 0.18, -wid / 2 + 4, len * 0.36, wid - 8, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(len * 0.18, -wid / 2 + 4, 4, wid - 8);
  if (kind === 'taxi') {
    ctx.fillStyle = '#f2c200';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (kind === 'police') {
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(-len / 2 + 4, -wid / 2 + 2, len - 8, 5);
    // Flashing light bar.
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? PALETTE.policeLight : PALETTE.policeLight2;
    ctx.fillRect(-4, -wid / 2 - 2, 8, 5);
    ctx.fillStyle = flash ? PALETTE.policeLight2 : PALETTE.policeLight;
    ctx.fillRect(-4, wid / 2 - 3, 8, 5);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  if (kind === 'target') {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(-len / 2 - 3, -wid / 2 - 3, len + 6, wid + 6);
  }
  if (wrecked) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-len / 2 + 6, -wid / 2 + 4);
    ctx.lineTo(len / 2 - 6, wid / 2 - 4);
    ctx.moveTo(len / 2 - 6, -wid / 2 + 4);
    ctx.lineTo(-len / 2 + 6, wid / 2 - 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCars(ctx, world, x0, y0, time) {
  for (const car of world.cars) {
    const sx = car.x - x0;
    const sy = car.y - y0;
    if (sx < -80 || sx > VIEW_W + 80 || sy < -80 || sy > VIEW_H + 80) continue;
    drawCarShape(ctx, sx, sy, car.angle, car.model, car.color, car.kind, time, car.wrecked);
    if (car.wrecked) continue;
    // Headlight cones at speed.
    if (Math.abs(car.speed) > 60) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(car.angle);
      ctx.fillStyle = 'rgba(255,240,170,0.12)';
      ctx.beginPath();
      ctx.moveTo(car.model.len / 2, -8);
      ctx.lineTo(car.model.len / 2 + 70, -26);
      ctx.lineTo(car.model.len / 2 + 70, 26);
      ctx.lineTo(car.model.len / 2, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawPeds(ctx, world, x0, y0, time) {
  for (const ped of world.peds) {
    const sx = ped.x - x0;
    const sy = ped.y - y0;
    if (sx < -30 || sx > VIEW_W + 30 || sy < -30 || sy > VIEW_H + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(sx + 2, sy + 5, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (ped.state === 'down') {
      // Lying flat.
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 14, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const bob = ped.state === 'walk' ? Math.sin(time * 8 + ped.id) * 1.5 : 0;
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(sx, sy - 2 + bob, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(sx + Math.cos(ped.angle) * 3, sy - 10 + bob, 4.5, 0, Math.PI * 2);
    ctx.fill();
    if (ped.courier) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy - 2, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawOfficers(ctx, world, x0, y0, time) {
  for (const o of world.police) {
    const sx = o.x - x0;
    const sy = o.y - y0;
    if (sx < -30 || sx > VIEW_W + 30 || sy < -30 || sy > VIEW_H + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(sx + 2, sy + 5, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (o.hp <= 0) {
      ctx.fillStyle = '#1c2733';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 14, 6, o.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const bob = Math.sin(time * 10 + o.id) * 1.5;
    ctx.fillStyle = '#1c2733';
    ctx.beginPath();
    ctx.arc(sx, sy - 2 + bob, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d7bff';
    ctx.beginPath();
    ctx.arc(sx, sy - 9 + bob, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(sx + Math.cos(o.angle) * 4, sy - 2 + bob, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx, world, x0, y0, time) {
  const p = world.player;
  if (p.inCar) return; // the car drawing carries the player
  const sx = p.x - x0;
  const sy = p.y - y0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(sx + 2, sy + 6, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = p.moving ? Math.sin(time * 12) * 1.5 : 0;
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(sx, sy - 2 + bob, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(sx + Math.cos(p.angle) * 4, sy - 11 + bob, 5, 0, Math.PI * 2);
  ctx.fill();
  // Pistol direction.
  const aim = p.aimAngle ?? p.angle;
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx + Math.cos(aim) * 8, sy - 2 + Math.sin(aim) * 8);
  ctx.lineTo(sx + Math.cos(aim) * 18, sy - 2 + Math.sin(aim) * 18);
  ctx.stroke();
  if (world.muzzle) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(world.muzzle.x - x0, world.muzzle.y - y0, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // Arrest progress ring over an officer closing in.
  for (const o of world.police) {
    if (o.arrestT > 0) {
      ctx.strokeStyle = '#ff2d2d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy - 18, 14, -Math.PI / 2, -Math.PI / 2 + (o.arrestT / 0.7) * Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawBullets(ctx, world, x0, y0) {
  ctx.strokeStyle = '#ffe9a3';
  ctx.lineWidth = 2;
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - x0 - b.vx * 0.02, b.y - y0 - b.vy * 0.02);
    ctx.lineTo(b.x - x0, b.y - y0);
    ctx.stroke();
  }
}

function drawParticles(ctx, world, x0, y0) {
  for (const pt of world.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x - x0, pt.y - y0, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- HUD ---

export function drawHUD(ctx, world, input) {
  drawMinimap(ctx, world);
  drawStars(ctx, world);
  drawStatus(ctx, world);
  drawObjective(ctx, world);
  drawBanner(ctx, world);
  if (world.mode === 'play' && !world.player.inCar) drawCrosshair(ctx, input);
  if (world.wanted >= 3) {
    ctx.fillStyle = 'rgba(255,0,0,0.06)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawMinimap(ctx, world) {
  const mw = 210;
  const mh = 150;
  const mx = 16;
  const my = 16;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#6f9e58';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(mx + SEA_X * sx, my, mw - SEA_X * sx, mh);
  ctx.fillStyle = '#ecd28a';
  ctx.fillRect(mx + BEACH_X * sx, my, (SEA_X - BEACH_X) * sx, mh);
  ctx.strokeStyle = '#3c3f45';
  ctx.lineWidth = 3;
  for (const vx of ROADS_V) {
    ctx.beginPath();
    ctx.moveTo(mx + vx * sx, my);
    ctx.lineTo(mx + vx * sx, my + mh);
    ctx.stroke();
  }
  for (const hy of ROADS_H) {
    ctx.beginPath();
    ctx.moveTo(mx, my + hy * sy);
    ctx.lineTo(mx + mw, my + hy * sy);
    ctx.stroke();
  }
  const target = missionTarget(world);
  if (target) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of world.policeCars) {
    if (car.wrecked) continue;
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath();
    ctx.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const o of world.police) {
    if (o.hp <= 0) continue;
    ctx.fillStyle = '#ff7b7b';
    ctx.beginPath();
    ctx.arc(mx + o.x * sx, my + o.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = world.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', mx + mw - 12, my + 14);
  ctx.fillText('SOLMAR BAY', mx, my + mh + 18);
}

function drawStars(ctx, world) {
  const stars = Math.ceil(world.wanted);
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'right';
  let text = '';
  for (let i = 0; i < 5; i++) text += i < stars ? '★' : '☆';
  ctx.fillStyle = 'rgba(10,14,20,0.6)';
  const w = ctx.measureText(text).width;
  roundRect(ctx, VIEW_W - 24 - w - 16, 14, w + 32, 44, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd700';
  ctx.fillText(text, VIEW_W - 24, 48);
  // Cash and clock under the stars.
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#7CFC98';
  ctx.fillText(`$${Math.floor(world.cash).toLocaleString('en-US')}`, VIEW_W - 24, 84);
  const mins = Math.floor(world.clockMinutes) % (24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`${hh}:${mm}`, VIEW_W - 24, 108);
}

function drawStatus(ctx, world) {
  const p = world.player;
  const bx = 16;
  const by = VIEW_H - 64;
  ctx.fillStyle = 'rgba(10,14,20,0.6)';
  roundRect(ctx, bx - 6, by - 6, 250, 54, 8);
  ctx.fill();
  // Health bar.
  ctx.fillStyle = '#333';
  ctx.fillRect(bx, by, 150, 14);
  ctx.fillStyle = p.hp > 50 ? '#4caf50' : p.hp > 25 ? '#ff9800' : '#f44336';
  ctx.fillRect(bx, by, 150 * clamp(p.hp / TUNING.playerMaxHp, 0, 1), 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, bx + 158, by + 12);
  // Ammo.
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`AMMO ${p.mag} / ${p.reserve}`, bx, by + 36);
  // Speed while driving.
  if (p.inCar) {
    const car = world.cars.find((c) => c.id === p.carId);
    const mph = car ? Math.abs(car.speed) * 0.14 : 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(mph)} mph`, VIEW_W - 24, VIEW_H - 24);
    if (car) {
      ctx.fillStyle = '#333';
      ctx.fillRect(VIEW_W - 224, VIEW_H - 48, 200, 10);
      ctx.fillStyle = car.hp > 50 ? '#4caf50' : '#f44336';
      ctx.fillRect(VIEW_W - 224, VIEW_H - 48, 200 * clamp(car.hp / 100, 0, 1), 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText('CAR', VIEW_W - 24, VIEW_H - 54);
    }
  }
  ctx.textAlign = 'left';
}

function drawObjective(ctx, world) {
  const text = currentObjective(world);
  if (!text) return;
  ctx.font = 'bold 17px system-ui, sans-serif';
  const w = ctx.measureText(text).width;
  const x = (VIEW_W - w) / 2;
  ctx.fillStyle = 'rgba(10,14,20,0.6)';
  roundRect(ctx, x - 14, 14, w + 28, 36, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_W / 2, 38);
  const timer = stageTimerText(world);
  if (timer) {
    ctx.fillStyle = '#ff8a80';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(timer, VIEW_W / 2, 72);
  }
  ctx.textAlign = 'left';
}

function drawBanner(ctx, world) {
  if (!world.banner) return;
  const b = world.banner;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  const w = 620;
  ctx.fillRect((VIEW_W - w) / 2, VIEW_H / 2 - 120, w, 84);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(b.text, VIEW_W / 2, VIEW_H / 2 - 84);
  if (b.sub) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(b.sub, VIEW_W / 2, VIEW_H / 2 - 54);
  }
  ctx.textAlign = 'left';
}

function drawCrosshair(ctx, input) {
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  const x = input.mouseX;
  const y = input.mouseY;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 14, y);
  ctx.lineTo(x - 6, y);
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x, y - 6);
  ctx.moveTo(x, y + 6);
  ctx.lineTo(x, y + 14);
  ctx.stroke();
}

// --- Menus ---

function menuPanel(ctx, title, lines, footer) {
  ctx.fillStyle = 'rgba(8,12,20,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText(title, VIEW_W / 2, 150);
  ctx.fillStyle = '#ffffff';
  ctx.font = '19px system-ui, sans-serif';
  let y = 210;
  for (const line of lines) {
    ctx.fillText(line, VIEW_W / 2, y);
    y += 30;
  }
  if (footer) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(footer, VIEW_W / 2, VIEW_H - 90);
  }
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, world) {
  // A sun-soaked skyline behind the title, drawn from the city itself.
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#ff9a3d');
  grad.addColorStop(0.55, '#ffcf6e');
  grad.addColorStop(1, '#2f7fb8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  const skyline = [90, 150, 110, 190, 130, 170, 100, 210, 140, 120];
  let sx = 0;
  for (const h of skyline) {
    ctx.fillRect(sx, VIEW_H - 180 - h, 128, h + 180);
    sx += 128;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // The sun stays bright above the dimming overlay.
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(VIEW_W - 220, 130, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('SOLMAR BAY', VIEW_W / 2, 200);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic bold 34px system-ui, sans-serif';
  ctx.fillText('— Streets of the Sun —', VIEW_W / 2, 252);
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillStyle = '#e8e8e8';
  const story = [
    'Rio Calder just rolled into Solmar Bay with an empty wallet and a fast mouth.',
    'Lena Voss runs the crew that runs this town. Six jobs stand between Rio',
    'and the big time — if the police don\u2019t catch him first.',
  ];
  let y = 320;
  for (const line of story) {
    ctx.fillText(line, VIEW_W / 2, y);
    y += 28;
  }
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = '#ffd700';
  const controls = [
    'WASD / Arrows — walk & drive    •    E — enter / exit car    •    Mouse — aim, Click — shoot',
    'R — reload    •    Space — handbrake    •    J — jobs    •    P — pause    •    M — mute',
  ];
  y = 460;
  for (const line of controls) {
    ctx.fillText(line, VIEW_W / 2, y);
    y += 26;
  }
  // The start prompt stays on: a screenshot must never catch it blinked off.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO START', VIEW_W / 2, 590);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#bbbbbb';
  ctx.fillText('An original game. No real city, no real gang, no borrowed anything.', VIEW_W / 2, 660);
  ctx.textAlign = 'left';
}

export function drawPause(ctx, world) {
  menuPanel(ctx, 'PAUSED', [
    'Take a breath. The city waits.',
    '',
    'WASD — move / drive      E — enter car      Click — shoot',
    'R — reload      Space — handbrake      J — jobs      M — mute',
    '',
    `Cash $${Math.floor(world.cash)}   •   Missions done ${world.stats.missionsDone} / ${MISSIONS.length}`,
  ], 'Press P or Escape to keep playing');
}

export function drawBusted(ctx, world) {
  menuPanel(ctx, 'BUSTED', [
    'The Solmar Bay police finally got their hands on you.',
    `A $${TUNING.bustFine} fine comes off your cash. The heat is gone — for now.`,
    '',
    `Cash $${Math.floor(world.cash)}   •   Missions done ${world.stats.missionsDone} / ${MISSIONS.length}`,
  ], 'Press Enter to get back on the street');
}

export function drawWasted(ctx, world) {
  menuPanel(ctx, 'WASTED', [
    'Rio went down hard on the streets of Solmar Bay.',
    `The hospital bill is $${TUNING.wastedLoss}. The crew is not impressed.`,
    '',
    `Cash $${Math.floor(world.cash)}   •   Missions done ${world.stats.missionsDone} / ${MISSIONS.length}`,
  ], 'Press Enter to get back on the street');
}

export function drawMissionsMenu(ctx, world) {
  ctx.fillStyle = 'rgba(8,12,20,0.85)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('JOBS — LENA\u2019S CREW', VIEW_W / 2, 90);
  ctx.font = '18px system-ui, sans-serif';
  let y = 150;
  MISSIONS.forEach((m, i) => {
    const done = i < world.stats.missionsDone;
    const active = world.mission && world.mission.index === i && world.mission.active;
    const locked = !done && !active && i > world.stats.missionsDone;
    ctx.fillStyle = active ? '#ffd700' : done ? '#7CFC98' : locked ? '#777' : '#ffffff';
    const mark = done ? '✓ DONE' : active ? '▶ ACTIVE' : locked ? '🔒 LOCKED' : '○ NEXT';
    ctx.fillText(`${i + 1}. ${m.name} — ${m.giver} — $${m.reward}  ${mark}`, VIEW_W / 2, y);
    y += 28;
    ctx.fillStyle = '#cccccc';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(m.briefing, VIEW_W / 2, y);
    ctx.font = '18px system-ui, sans-serif';
    y += 40;
  });
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Press J to close — the next job starts on its own when you are ready', VIEW_W / 2, VIEW_H - 70);
  ctx.textAlign = 'left';
}
