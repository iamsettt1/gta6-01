// The story chain: Rio Calder, new in Solmar Bay, works his way up through
// Lena Voss's crew. Six missions, each a list of stages; the world owns the
// live state, this file owns the script and the stage rules.

export const MISSIONS = [
  {
    id: 'first-errand',
    name: 'First Errand',
    giver: 'Lena Voss',
    briefing: 'A package is waiting at the Harbour docks. Pick it up and drive it to the Sunrise Cafe downtown. No detours, no questions.',
    reward: 300,
    stages: [
      { kind: 'goto', x: 420, y: 2050, r: 70, text: 'Pick up the package at the Harbour docks' },
      { kind: 'goto', x: 1560, y: 1240, r: 70, text: 'Deliver the package to the Sunrise Cafe' },
    ],
  },
  {
    id: 'hot-wheels',
    name: 'Hot Wheels',
    giver: 'Tomas Ibarra',
    briefing: 'Tomas needs a sun-yellow coupe parked by the old cinema. Take it — quietly if you can — and bring it to his garage.',
    reward: 500,
    stages: [
      { kind: 'steal', x: 2160, y: 860, r: 90, text: 'Steal the yellow coupe by the old cinema' },
      { kind: 'goto', x: 960, y: 1740, r: 80, text: 'Deliver the coupe to Tomas\u2019s garage' },
    ],
  },
  {
    id: 'long-way-home',
    name: 'The Long Way Home',
    giver: 'Lena Voss',
    briefing: 'The harbour job went loud. The police are on you. Shake them and get to the safehouse in Palm Heights — and stay out of their sight.',
    reward: 700,
    stages: [
      { kind: 'escape', seconds: 12, text: 'Lose the police — stay unseen until the heat fades' },
      { kind: 'goto', x: 2640, y: 360, r: 80, text: 'Reach the Palm Heights safehouse' },
    ],
  },
  {
    id: 'corner-the-courier',
    name: 'Corner the Courier',
    giver: 'Nadia Kaur',
    briefing: 'A courier is carrying the crew\u2019s ledger through the Market Quarter on foot. Run him down and take it back. No guns needed — just legs.',
    reward: 600,
    stages: [
      { kind: 'chase', r: 48, text: 'Catch the courier on foot in the Market Quarter' },
    ],
  },
  {
    id: 'against-the-clock',
    name: 'Against the Clock',
    giver: 'Lena Voss',
    briefing: 'A buyer is waiting at the Beachfront hotel and the tide waits for no one. Ninety seconds, cross-town, don\u2019t stop for anything.',
    reward: 900,
    stages: [
      { kind: 'timed', x: 3060, y: 860, r: 80, seconds: 100, text: 'Deliver to the Beachfront hotel before the timer runs out' },
    ],
  },
  {
    id: 'duarte-vault',
    name: 'The Duarte Vault',
    giver: 'Lena Voss',
    briefing: 'Anselmo Duarte keeps the crew\u2019s money in the downtown vault. Walk in, hold the room, walk out rich — then lose every cop in the city.',
    reward: 2500,
    stages: [
      { kind: 'hold', x: 2040, y: 1240, r: 90, seconds: 6, text: 'Hold the vault room while the safe opens' },
      { kind: 'goto', x: 2640, y: 360, r: 80, text: 'Escape to the Palm Heights safehouse' },
    ],
  },
];

export function missionCount() {
  return MISSIONS.length;
}

export function startMission(world, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  world.mission = {
    index,
    def,
    stage: 0,
    timer: 0,
    holdT: 0,
    active: true,
    done: false,
    targetCarId: null,
    targetPedId: null,
  };
  world.banner = { text: `MISSION: ${def.name}`, sub: def.briefing, t: 4.5 };
  if (typeof world.onMissionStart === 'function') world.onMissionStart(world, def);
  return true;
}

export function currentStage(world) {
  if (!world.mission || !world.mission.active) return null;
  return world.mission.def.stages[world.mission.stage] || null;
}

export function currentObjective(world) {
  if (!world.mission) return 'Press J to see the next job';
  if (world.mission.done) return 'All missions complete — free roam';
  const s = currentStage(world);
  if (!s) return '';
  return s.text;
}

// The live marker position for the minimap and the world beacon. For the
// chase stage the marker follows the courier; for steal it follows the car.
export function missionTarget(world) {
  if (!world.mission || !world.mission.active) return null;
  const s = currentStage(world);
  if (!s) return null;
  if (s.kind === 'steal' && world.mission.targetCarId != null) {
    const car = world.cars.find((c) => c.id === world.mission.targetCarId);
    if (car) return { x: car.x, y: car.y };
  }
  if (s.kind === 'chase' && world.mission.targetPedId != null) {
    const ped = world.peds.find((p) => p.id === world.mission.targetPedId);
    if (ped) return { x: ped.x, y: ped.y };
  }
  if (s.kind === 'escape') return { x: 2640, y: 360 };
  return { x: s.x, y: s.y };
}

function completeStage(world) {
  const m = world.mission;
  m.stage += 1;
  m.timer = 0;
  m.holdT = 0;
  if (m.stage >= m.def.stages.length) {
    completeMission(world);
  } else {
    const s = currentStage(world);
    if (s) world.banner = { text: 'OBJECTIVE UPDATED', sub: s.text, t: 3 };
  }
}

function completeMission(world) {
  const m = world.mission;
  m.active = false;
  m.done = true;
  world.cash += m.def.reward;
  world.stats.missionsDone += 1;
  world.banner = { text: 'MISSION COMPLETE', sub: `${m.def.name} — +$${m.def.reward}`, t: 4 };
  if (typeof world.onMissionComplete === 'function') world.onMissionComplete(world, m.def);
  const next = m.index + 1;
  if (next < MISSIONS.length) {
    world.nextMissionAt = world.time + 2.5;
    world.pendingMission = next;
  } else {
    world.banner = { text: 'STORY COMPLETE', sub: 'Every job done. Solmar Bay is yours — free roam.', t: 5 };
  }
}

function failMission(world, reason) {
  const m = world.mission;
  if (!m || !m.active) return;
  m.active = false;
  world.banner = { text: 'MISSION FAILED', sub: reason, t: 3.5 };
  world.nextMissionAt = world.time + 3;
  world.pendingMission = m.index; // retry the same job
}

export function updateMission(world, dt) {
  if (world.pendingMission != null && world.time >= (world.nextMissionAt || 0)) {
    const idx = world.pendingMission;
    world.pendingMission = null;
    startMission(world, idx);
  }
  const m = world.mission;
  if (!m || !m.active) return;
  const s = currentStage(world);
  if (!s) return;
  const p = world.player;

  if (s.kind === 'goto' || s.kind === 'pickup') {
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < s.r) completeStage(world);
  } else if (s.kind === 'steal') {
    const car = world.cars.find((c) => c.id === m.targetCarId);
    if (!car) {
      failMission(world, 'The target car is gone');
    } else if (p.inCar && p.carId === car.id) {
      completeStage(world);
    }
  } else if (s.kind === 'chase') {
    const ped = world.peds.find((x) => x.id === m.targetPedId);
    if (!ped) {
      failMission(world, 'The courier got away');
    } else if (!p.inCar && Math.hypot(p.x - ped.x, p.y - ped.y) < s.r) {
      completeStage(world);
    }
  } else if (s.kind === 'escape') {
    m.timer += dt;
    const seen = world.police.some((o) => o.dist < 420) || world.policeCars.some((c) => c.dist < 420);
    if (!seen) {
      // Breaking visual contact is what loses the heat: stay unseen.
      m.hideT = (m.hideT || 0) + dt;
      if (m.hideT > 8) completeStage(world);
    } else {
      m.hideT = 0;
    }
    // The stage also completes once the wanted level has fully decayed.
    if (world.wanted <= 0 && m.timer > 6) completeStage(world);
    else if (m.timer > s.seconds * 4) {
      failMission(world, 'The police never lost you');
    }
  } else if (s.kind === 'hold') {
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < s.r) {
      m.holdT += dt;
      if (m.holdT >= s.seconds) completeStage(world);
    } else {
      m.holdT = Math.max(0, m.holdT - dt * 2);
    }
  } else if (s.kind === 'timed') {
    m.timer += dt;
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < s.r) {
      completeStage(world);
    } else if (m.timer >= s.seconds) {
      failMission(world, 'Out of time');
    }
  }
}

// Stage countdowns the HUD shows (timed delivery, vault hold, escape wait).
export function stageTimerText(world) {
  const m = world.mission;
  if (!m || !m.active) return null;
  const s = currentStage(world);
  if (!s) return null;
  if (s.kind === 'timed') return `TIME ${Math.max(0, Math.ceil(s.seconds - m.timer))}s`;
  if (s.kind === 'hold') return `HOLD ${Math.max(0, Math.ceil(s.seconds - m.holdT))}s`;
  if (s.kind === 'escape') return `STAY UNSEEN ${Math.ceil(m.hideT || 0)}s / 8s`;
  return null;
}
