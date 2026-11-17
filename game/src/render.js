// Drawing only: the world's state and the current screen in, pixels out. A
// 1280x720 logical view follows the player across the 3600x2600 city; the view
// scales to the window. Sun-soaked colours: warm roads, sand, palm greens and
// neon signs on the Mile. The HUD carries wanted stars, health, cash, the clock,
// the mission objective, speed and ammo, and a live minimap with player, police
// and mission markers. Menus are drawn on the same canvas so a screenshot shows
// the game as it really is.
import { FONT, PLAYER, WORLD } from './config.js';
import { DISTRICTS } from './city.js';
import { MISSIONS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_MISSIONS = 'missions';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const VIEW = { width: 1280, height: 720 };

const PALETTE = {
  grass: '#7fae5f',
  park: '#5f9a4a',
  road: '#4a4642',
  roadEdge: '#3a3633',
  lane: '#e8d98a',
  sidewalk: '#b8a888',
  sand: '#e8cf9a',
  sea: '#2a7ab8',
  seaDeep: '#1d5a8a',
  buildingShadow: 'rgba(0,0,0,0.25)',
  text: '#f5f0e6',
  muted: '#c9c2b2',
  panel: 'rgba(20,18,24,0.88)',
  panelEdge: '#e8a33d',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4f8ad9',
  green: '#6ad94f',
};

function clockText(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function dayTint(minutes) {
  // Warm afternoon light; the city cools toward dusk after 18:00.
  const h = (minutes / 60) % 24;
  if (h >= 18 || h < 6) return 'rgba(40,50,90,0.18)';
  if (h >= 16) return 'rgba(232,140,60,0.10)';
  return 'rgba(255,220,140,0.06)';
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: 0, y: 0 };
  let missionRows = [];

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, bold) {
    const key = `${size}${bold ? 'b' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawCity(state) {
    const city = state.city;
    const camX = camera.x;
    const camY = camera.y;
    const vw = VIEW.width;
    const vh = VIEW.height;
    // Ground: grass everywhere, then districts get their own tint.
    context.fillStyle = PALETTE.grass;
    context.fillRect(camX - 20, camY - 20, vw + 40, vh + 40);
    for (const d of DISTRICTS) {
      context.fillStyle = d.tint;
      context.globalAlpha = 0.16;
      context.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
      context.globalAlpha = 1;
    }
    // Sea and beach along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, WORLD.beachTop, WORLD.width, WORLD.height - WORLD.beachTop);
    context.fillStyle = PALETTE.sea;
    context.fillRect(0, WORLD.beachTop + 110, WORLD.width, WORLD.height - WORLD.beachTop - 110);
    context.fillStyle = PALETTE.seaDeep;
    for (let x = 0; x < WORLD.width; x += 180) {
      context.fillRect(x + ((state.elapsed * 12 + x) % 180), WORLD.beachTop + 150 + ((x * 7) % 60), 90, 5);
    }
    // Parks.
    for (const park of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
      context.strokeStyle = '#3f7a30';
      context.lineWidth = 3;
      context.strokeRect(park.x, park.y, park.w, park.h);
    }
    // Roads: asphalt, sidewalks, centre dashes.
    for (const ax of WORLD.avenues) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(ax - WORLD.roadWidth / 2 - 10, 0, WORLD.roadWidth + 20, WORLD.beachTop);
      context.fillStyle = PALETTE.road;
      context.fillRect(ax - WORLD.roadWidth / 2, 0, WORLD.roadWidth, WORLD.beachTop);
    }
    for (const sy of WORLD.streets) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, sy - WORLD.roadWidth / 2 - 10, WORLD.width, WORLD.roadWidth + 20);
      context.fillStyle = PALETTE.road;
      context.fillRect(0, sy - WORLD.roadWidth / 2, WORLD.width, WORLD.roadWidth);
    }
    context.fillStyle = PALETTE.lane;
    for (const ax of WORLD.avenues) {
      for (let y = 0; y < WORLD.beachTop; y += 56) {
        if (WORLD.streets.some((s) => Math.abs(y - s) < WORLD.roadWidth / 2 + 6)) continue;
        context.fillRect(ax - 3, y, 6, 28);
      }
    }
    for (const sy of WORLD.streets) {
      for (let x = 0; x < WORLD.width; x += 56) {
        if (WORLD.avenues.some((a) => Math.abs(x - a) < WORLD.roadWidth / 2 + 6)) continue;
        context.fillRect(x, sy - 3, 28, 6);
      }
    }
    // Crosswalks at intersections.
    context.fillStyle = 'rgba(240,240,230,0.85)';
    for (const ax of WORLD.avenues) {
      for (const sy of WORLD.streets) {
        for (let i = -3; i <= 3; i += 1) {
          context.fillRect(ax + i * 13 - 4, sy - WORLD.roadWidth / 2 + 8, 8, 18);
          context.fillRect(ax + i * 13 - 4, sy + WORLD.roadWidth / 2 - 26, 8, 18);
        }
      }
    }
    // Buildings: shadow offset by height, then walls and roof.
    for (const b of city.buildings) {
      const off = b.height * 7;
      context.fillStyle = PALETTE.buildingShadow;
      context.fillRect(b.x + off, b.y + off, b.w, b.h);
      context.fillStyle = b.wall;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(b.x + 6, b.y + 6, b.w - 12, 8);
      // Windows on taller buildings.
      if (b.height >= 2) {
        context.fillStyle = '#2a3a4a';
        for (let wx = b.x + 16; wx < b.x + b.w - 14; wx += 26) {
          for (let wy = b.y + 20; wy < b.y + b.h - 14; wy += 26) {
            context.fillRect(wx, wy, 12, 14);
          }
        }
      }
    }
    // Props: lamps, palms, benches, crates.
    for (const prop of city.props) {
      if (prop.kind === 'lamp') {
        context.fillStyle = '#2a2a2a';
        context.fillRect(prop.x - 2, prop.y - 2, 4, 4);
        context.fillStyle = '#ffe9a8';
        context.beginPath();
        context.arc(prop.x, prop.y, 5, 0, Math.PI * 2);
        context.fill();
      } else if (prop.kind === 'palm') {
        context.strokeStyle = '#6a4a2a';
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(prop.x, prop.y);
        context.lineTo(prop.x + 3, prop.y - 14);
        context.stroke();
        context.fillStyle = '#3f8a3a';
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2;
          context.beginPath();
          context.ellipse(prop.x + 3 + Math.cos(a) * 10, prop.y - 16 + Math.sin(a) * 6, 11, 4, a, 0, Math.PI * 2);
          context.fill();
        }
      } else if (prop.kind === 'bench') {
        context.fillStyle = '#7a5a3a';
        context.fillRect(prop.x - 18, prop.y - 6, 36, 12);
      } else if (prop.kind === 'crate') {
        context.fillStyle = '#a87a3a';
        context.fillRect(prop.x - 9, prop.y - 9, 18, 18);
        context.strokeStyle = '#6a4a2a';
        context.lineWidth = 2;
        context.strokeRect(prop.x - 9, prop.y - 9, 18, 18);
      }
    }
    // Mission marker: a pulsing beacon over the current objective.
    const marker = currentMarker(state);
    if (marker) {
      const pulse = 1 + Math.sin(state.elapsed * 4) * 0.12;
      context.save();
      context.translate(marker.x, marker.y);
      context.scale(pulse, pulse);
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(0, -26);
      context.lineTo(16, -6);
      context.lineTo(0, 10);
      context.lineTo(-16, -6);
      context.closePath();
      context.fill();
      context.fillStyle = '#1d1a12';
      context.font = `700 13px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('!', 0, 2);
      context.restore();
      // A faint column of light so the marker reads from far away.
      context.fillStyle = 'rgba(242,201,76,0.10)';
      context.fillRect(marker.x - 22, marker.y - 130, 44, 130);
    }
  }

  function currentMarker(state) {
    if (!state.missionActive) return null;
    const m = state.missionId ? MISSIONS.find((x) => x.id === state.missionId) : null;
    if (!m) return null;
    const step = m.steps[state.missionStep];
    if (!step || step.x === undefined) return null;
    return { x: step.x, y: step.y };
  }

  function drawCar(car) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(-28 + 4, -13 + 5, 56, 26);
    context.fillStyle = car.color;
    roundRect(-28, -13, 56, 26, 7);
    context.fill();
    // Roof and windows.
    context.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(-8, -11, 20, 22, 5);
    context.fill();
    context.fillStyle = '#bfe0f2';
    context.fillRect(-4, -10, 10, 20);
    // Headlights and tail lights.
    context.fillStyle = '#ffe9a8';
    context.fillRect(26, -11, 3, 6);
    context.fillRect(26, 5, 3, 6);
    context.fillStyle = '#e5534b';
    context.fillRect(-29, -11, 3, 6);
    context.fillRect(-29, 5, 3, 6);
    if (car.isPolice) {
      context.fillStyle = '#f5f0e6';
      context.fillRect(-2, -13, 8, 26);
      const blink = Math.floor(Date.now() / 300) % 2 === 0;
      context.fillStyle = blink ? '#ff3b30' : '#3b82ff';
      context.beginPath();
      context.arc(-2, -6, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = blink ? '#3b82ff' : '#ff3b30';
      context.beginPath();
      context.arc(-2, 6, 5, 0, Math.PI * 2);
      context.fill();
    }
    if (car.isTarget) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      context.strokeRect(-30, -15, 60, 30);
    }
    context.restore();
  }

  function drawPerson(x, y, angle, shirt, down, isOfficer) {
    context.save();
    context.translate(x, y);
    if (down) {
      context.rotate(angle + Math.PI / 2);
      context.fillStyle = shirt;
      context.beginPath();
      context.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    context.rotate(angle);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(2, 3, 12, 10, 0, 0, Math.PI * 2);
    context.fill();
    // Body: a little top-down walker with a facing nose.
    context.fillStyle = isOfficer ? '#1d3a5f' : shirt;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b88a';
    context.beginPath();
    context.arc(4, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = isOfficer ? '#0f2440' : '#2a2a2a';
    context.beginPath();
    context.arc(6, -3, 2.4, 0, Math.PI * 2);
    context.arc(6, 3, 2.4, 0, Math.PI * 2);
    context.fill();
    if (isOfficer) {
      context.fillStyle = '#d9d9d9';
      context.fillRect(8, -2, 8, 4);
    }
    context.restore();
  }

  function drawEntities(state) {
    // Pickups.
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      const bob = Math.sin(state.elapsed * 3 + pk.bob) * 2;
      context.save();
      context.translate(pk.x, pk.y + bob);
      if (pk.kind === 'cash') {
        context.fillStyle = '#2a8a4a';
        context.fillRect(-10, -7, 20, 14);
        context.fillStyle = '#f2c94c';
        context.font = `700 12px ${FONT}`;
        context.textAlign = 'center';
        context.fillText('$', 0, 4);
      } else if (pk.kind === 'ammo') {
        context.fillStyle = '#8a6a2a';
        context.fillRect(-8, -8, 16, 16);
        context.fillStyle = '#f2c94c';
        context.font = `700 11px ${FONT}`;
        context.textAlign = 'center';
        context.fillText('A', 0, 4);
      } else {
        context.fillStyle = '#c94f3d';
        context.fillRect(-9, -9, 18, 18);
        context.fillStyle = '#f5f0e6';
        context.fillRect(-2, -6, 4, 12);
        context.fillRect(-6, -2, 12, 4);
      }
      context.restore();
    }
    // Parked and traffic cars, then police cars.
    for (const car of state.cars) {
      if (car.kind === 'police') continue;
      drawCar(car);
    }
    for (const car of state.policeCars) drawCar(car);
    // Pedestrians.
    for (const ped of state.peds) {
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.down, false);
    }
    // Officers.
    for (const o of state.officers) {
      drawPerson(o.x, o.y, o.angle, '#1d3a5f', false, true);
      if (o.health < 50) {
        context.fillStyle = '#1d1a12';
        context.fillRect(o.x - 14, o.y - 24, 28, 5);
        context.fillStyle = '#e5534b';
        context.fillRect(o.x - 14, o.y - 24, 28 * (o.health / 50), 5);
      }
    }
    // Bullets.
    context.fillStyle = '#ffe9a8';
    for (const b of state.bullets) {
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    // The player: on foot a walker in a teal jacket; in a car, the car is the player.
    const p = state.player;
    if (!p.inCar) {
      const blink = p.hurtTimer > 0 && Math.floor(p.hurtTimer * 12) % 2 === 0;
      if (!blink) drawPerson(p.x, p.y, p.aimAngle, '#2a9a8a', false, false);
      // Aim line while the pistol is out.
      context.strokeStyle = 'rgba(255,233,168,0.5)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20);
      context.lineTo(p.x + Math.cos(p.aimAngle) * 60, p.y + Math.sin(p.aimAngle) * 60);
      context.stroke();
      if (p.punchTimer > 0) {
        context.strokeStyle = 'rgba(255,255,255,0.7)';
        context.lineWidth = 3;
        context.beginPath();
        context.arc(p.x, p.y, 30, p.aimAngle - 0.9, p.aimAngle + 0.9);
        context.stroke();
      }
    } else {
      // A gold ring marks the player's car.
      context.strokeStyle = 'rgba(242,201,76,0.85)';
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(p.x, p.y, 34, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawMinimap(state) {
    const mw = 220;
    const mh = 158;
    const mx = 16;
    const my = VIEW.height - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.save();
    context.fillStyle = 'rgba(20,18,24,0.85)';
    roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    // Roads.
    context.strokeStyle = '#8a8578';
    context.lineWidth = 2;
    for (const ax of WORLD.avenues) {
      context.beginPath();
      context.moveTo(mx + ax * sx, my);
      context.lineTo(mx + ax * sx, my + mh);
      context.stroke();
    }
    for (const sy2 of WORLD.streets) {
      context.beginPath();
      context.moveTo(mx, my + sy2 * sy);
      context.lineTo(mx + mw, my + sy2 * sy);
      context.stroke();
    }
    // Sea.
    context.fillStyle = '#2a7ab8';
    context.fillRect(mx, my + WORLD.beachTop * sy, mw, mh - WORLD.beachTop * sy);
    // Mission marker.
    const marker = currentMarker(state);
    if (marker) {
      context.fillStyle = PALETTE.gold;
      context.save();
      context.translate(mx + marker.x * sx, my + marker.y * sy);
      context.rotate(Math.PI / 4);
      context.fillRect(-5, -5, 10, 10);
      context.restore();
    }
    // Police as red dots, player as a white arrow.
    context.fillStyle = '#ff5a4f';
    for (const car of state.policeCars) {
      context.beginPath();
      context.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    for (const o of state.officers) {
      context.beginPath();
      context.arc(mx + o.x * sx, my + o.y * sy, 2.5, 0, Math.PI * 2);
      context.fill();
    }
    const p = state.player;
    context.save();
    context.translate(mx + p.x * sx, my + p.y * sy);
    context.rotate(p.angle);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(7, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
    // North arrow and district label.
    text('N', mx + mw - 12, my + 14, 13, PALETTE.text, 'center', true);
    context.strokeStyle = PALETTE.text;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(mx + mw - 12, my + 28);
    context.lineTo(mx + mw - 12, my + 18);
    context.stroke();
    context.restore();
  }

  function drawHud(state, save) {
    const p = state.player;
    context.textBaseline = 'alphabetic';
    // Top-left: wanted stars, health, cash.
    for (let i = 0; i < 5; i += 1) {
      text(i < state.stars ? '★' : '☆', 20 + i * 30, 40, 30, i < state.stars ? PALETTE.gold : 'rgba(245,240,230,0.5)', 'left', true);
    }
    if (state.stars > 0) {
      text(state.stars >= 3 ? 'THE HEAT IS ON' : 'WANTED', 20, 66, 13, '#ff8a7a', 'left', true);
    }
    context.fillStyle = 'rgba(20,18,24,0.8)';
    roundRect(18, 74, 220, 20, 6);
    context.fill();
    context.fillStyle = p.health > 35 ? '#6ad94f' : '#e5534b';
    roundRect(20, 76, 216 * (p.health / 100), 16, 5);
    context.fill();
    text(`HP ${Math.ceil(p.health)}`, 24, 89, 12, '#ffffff', 'left', true);
    text(`$${state.cash.toLocaleString('en-US')}`, 20, 122, 26, PALETTE.gold, 'left', true);
    // Top-right: clock and district, on a dark pill so they read over roads.
    const district = state.city.districtAt(p.x, p.y);
    context.fillStyle = 'rgba(20,18,24,0.72)';
    roundRect(VIEW.width - 216, 12, 200, 82, 8);
    context.fill();
    text(clockText(state.clockMinutes), VIEW.width - 20, 40, 28, PALETTE.text, 'right', true);
    text(district.name, VIEW.width - 20, 66, 15, PALETTE.muted, 'right');
    if (save && save.completed) {
      text(`Missions ${save.completed.length}/6`, VIEW.width - 20, 88, 13, PALETTE.muted, 'right');
    }
    // Objective bar, top centre, sized to its text.
    const m = state.missionId ? MISSIONS.find((x) => x.id === state.missionId) : null;
    if (m) {
      const step = m.steps[state.missionStep];
      const label = step ? step.text : '';
      context.font = `14px ${FONT}`;
      const w = Math.max(420, context.measureText(label).width + 90);
      context.fillStyle = 'rgba(20,18,24,0.94)';
      roundRect(VIEW.width / 2 - w / 2, 12, w, 52, 8);
      context.fill();
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 1.5;
      context.stroke();
      text(`${m.title}`, VIEW.width / 2, 34, 15, PALETTE.gold, 'center', true);
      text(label, VIEW.width / 2, 56, 14, PALETTE.text, 'center');
      if (step && step.type === 'chase') {
        const left = Math.max(0, step.seconds - state.missionTimer);
        text(`${Math.ceil(left)}s`, VIEW.width / 2 + w / 2 - 14, 34, 15, '#ff8a7a', 'right', true);
      }
    } else {
      context.fillStyle = 'rgba(20,18,24,0.7)';
      roundRect(VIEW.width / 2 - 190, 12, 380, 34, 8);
      context.fill();
      text('Free roam — press J for missions', VIEW.width / 2, 35, 14, PALETTE.muted, 'center');
    }
    // Bottom-right: speed and ammo.
    if (p.inCar) {
      const mph = Math.round(Math.abs(p.inCar.speed) * 0.09);
      text(`${mph}`, VIEW.width - 20, VIEW.height - 56, 44, PALETTE.text, 'right', true);
      text('MPH', VIEW.width - 20, VIEW.height - 30, 13, PALETTE.muted, 'right', true);
      text(p.inCar.model.name, VIEW.width - 20, VIEW.height - 96, 15, PALETTE.gold, 'right', true);
    }
    text(p.inCar ? 'E exit car · Space handbrake' : `Ammo ${p.ammo} · E enter car · F punch · Click shoot`, VIEW.width - 20, VIEW.height - 12, 13, PALETTE.muted, 'right');
    // Toast.
    if (state.toast) {
      context.fillStyle = 'rgba(20,18,24,0.85)';
      const tw = 460;
      roundRect(VIEW.width / 2 - tw / 2, 76, tw, 34, 8);
      context.fill();
      text(state.toast.text, VIEW.width / 2, 99, 15, PALETTE.gold, 'center', true);
    }
    // Dialogue panel.
    if (state.dialogue) {
      const dw = 720;
      const dx = VIEW.width / 2 - dw / 2;
      const dy = VIEW.height - 150;
      context.fillStyle = PALETTE.panel;
      roundRect(dx, dy, dw, 76, 10);
      context.fill();
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 2;
      context.stroke();
      if (state.dialogue.speaker) {
        text(state.dialogue.speaker, dx + 18, dy + 24, 14, PALETTE.gold, 'left', true);
      }
      wrapText(state.dialogue.text, dx + 18, dy + (state.dialogue.speaker ? 48 : 30), dw - 36, 16, PALETTE.text);
    }
    drawMinimap(state);
  }

  function wrapText(value, x, y, maxWidth, size, color) {
    const words = value.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      context.font = `${size}px ${FONT}`;
      if (context.measureText(test).width > maxWidth && line) {
        text(line, x, cy, size, color, 'left');
        line = word;
        cy += size + 4;
      } else {
        line = test;
      }
    }
    if (line) text(line, x, cy, size, color, 'left');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 680;
    const lineHeight = 26;
    const height = 150 + lines.length * lineHeight + 60;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 3;
    context.stroke();
    text(title, VIEW.width / 2, y + 74, 46, accent || PALETTE.gold, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 128 + i * lineHeight, 17, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 30, 18, PALETTE.gold, 'center', true);
  }

  function drawTitle(state, save) {
    const done = save && save.completed ? save.completed.length : 0;
    const lines = [
      'Milo Reyes is back in Solmar Bay — and club owner Vince Marlowe owns his debt.',
      'Six jobs stand between Milo and freedom. Steal cars, outrun the Solmar Bay PD,',
      'and pull the Grand Job at the Solmar Grand. The city is yours: five districts,',
      'traffic, crowds, and a wanted level that answers every crime.',
      '',
      'WASD move / drive · Mouse aim · Click shoot · F punch · E enter / steal car',
      'Shift run · Space handbrake · R reload · J missions · P pause · M mute',
      '',
      done >= 6 ? 'Story complete — free roam, legend.' : `Missions finished: ${done} / 6 · Best cash $${(save && save.bestCash ? save.bestCash : 0).toLocaleString('en-US')}`,
    ];
    // Title over the live city, dimmed; the panel sits below the title so the
    // two never overlap.
    context.fillStyle = 'rgba(10,10,16,0.45)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text('SOLMAR BAY', VIEW.width / 2, 96, 78, PALETTE.gold, 'center', true);
    text('STREETS OF THE SUN', VIEW.width / 2, 136, 24, PALETTE.text, 'center', true);
    const width = 680;
    const lineHeight = 26;
    const height = 30 + lines.length * lineHeight + 56;
    const x = (VIEW.width - width) / 2;
    const y = 168;
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    context.stroke();
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 44 + i * lineHeight, 17, PALETTE.muted, 'center');
    }
    text('Press ENTER or click to start', VIEW.width / 2, y + height - 26, 18, PALETTE.gold, 'center', true);
  }

  function drawMissions(state, save) {
    context.fillStyle = 'rgba(10,10,16,0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    const width = 760;
    const x = (VIEW.width - width) / 2;
    const y = 70;
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, width, 560, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    context.stroke();
    text('MISSIONS — Solmar Bay', VIEW.width / 2, y + 52, 34, PALETTE.gold, 'center', true);
    text('Click a mission or press its number to start it. J or Esc closes this menu.', VIEW.width / 2, y + 82, 15, PALETTE.muted, 'center');
    missionRows = [];
    const completed = save && save.completed ? save.completed : [];
    let rowY = y + 110;
    MISSIONS.forEach((m, i) => {
      const done = completed.includes(m.id);
      const isNext = !done && (i === 0 || completed.includes(MISSIONS[i - 1].id));
      const rowH = 62;
      context.fillStyle = done ? 'rgba(106,217,79,0.12)' : isNext ? 'rgba(242,201,76,0.12)' : 'rgba(255,255,255,0.04)';
      roundRect(x + 24, rowY, width - 48, rowH, 8);
      context.fill();
      text(`${i + 1}. ${m.title}`, x + 44, rowY + 26, 19, done ? '#6ad94f' : PALETTE.text, 'left', true);
      text(done ? 'DONE' : isNext ? 'AVAILABLE' : 'LOCKED', x + width - 44, rowY + 26, 14, done ? '#6ad94f' : isNext ? PALETTE.gold : PALETTE.muted, 'right', true);
      text(`$${m.reward}  ·  ${m.briefing.slice(0, 78)}…`, x + 44, rowY + 50, 13, PALETTE.muted, 'left');
      missionRows.push({ x: x + 24, y: rowY, w: width - 48, h: rowH, id: m.id, available: done || isNext });
      rowY += rowH + 10;
    });
  }

  function missionAt(x, y) {
    for (const row of missionRows) {
      if (x >= row.x && x <= row.x + row.w && y >= row.y && y <= row.y + row.h) {
        return row.available ? row.id : null;
      }
    }
    return null;
  }

  /** Paint one frame: the city and entities through the camera, then HUD or a menu. */
  function draw(state, screen, save) {
    const p = state.player;
    camera.x = Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2));
    camera.y = Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#11141b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // World space, translated by the camera.
    context.save();
    context.translate(-camera.x, -camera.y);
    drawCity(state);
    drawEntities(state);
    context.restore();
    // Daylight tint over the whole view.
    context.fillStyle = dayTint(state.clockMinutes);
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    // Wanted flash: a red vignette while the heat is high.
    if (state.stars >= 3 && screen === SCREEN_PLAY) {
      const pulse = 0.05 + Math.sin(state.elapsed * 5) * 0.02;
      context.fillStyle = `rgba(229,83,75,${pulse})`;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    if (screen === SCREEN_TITLE) {
      drawTitle(state, save);
      return;
    }
    drawHud(state, save);
    if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(10,10,16,0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('PAUSED', ['The city waits. Your wanted level does not cool while paused —', 'it just waits for you to come back and deal with it.'], 'P to resume · J missions · Enter to restart the run');
    } else if (screen === SCREEN_MISSIONS) {
      drawMissions(state, save);
    } else if (screen === SCREEN_BUSTED) {
      const fine = state.fine !== undefined ? state.fine : Math.min(200, state.cash);
      drawPanel('BUSTED', [`The Solmar Bay PD took Milo in. Cash lost: $${fine}.`, `Missions finished: ${state.completed.length} / 6 · Cash $${state.cash.toLocaleString('en-US')}`], 'Press ENTER to get out and run it back', '#4f8ad9');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Milo went down in the streets of Solmar Bay.', `Missions finished: ${state.completed.length} / 6 · Cash $${state.cash.toLocaleString('en-US')}`], 'Press ENTER to get back up', PALETTE.red);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    missionAt,
    // Convert a CSS-pixel click (relative to the canvas) into logical view coordinates.
    toLogical(px, py) {
      const ratio = window.devicePixelRatio || 1;
      return { x: (px * ratio - view.x) / view.scale, y: (py * ratio - view.y) / view.scale };
    },
    // Convert a world point into logical view coordinates (the camera centres on the player).
    toScreen(wx, wy) {
      return { x: wx - camera.x, y: wy - camera.y };
    },
  };
}
