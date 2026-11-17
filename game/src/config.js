// Solmar Bay — Streets of the Sun: every tunable number for the game lives here,
// so the rules (world size, speeds, wanted decay, police response) are in one place.

export const WORLD_W = 3600;
export const WORLD_H = 2600;
export const ROAD_W = 120;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const SAVE_KEY = 'solmar-bay-save-v1';

// Road centrelines. The grid makes the city readable on the minimap and gives
// traffic and the autopilot a network to follow.
export const ROADS_V = [300, 900, 1500, 2100, 2700, 3300];
export const ROADS_H = [300, 800, 1300, 1800, 2300];

// The sea hems the east edge; the sand strip in front of it is walkable beach.
export const SEA_X = 3420;
export const BEACH_X = 3200;

export const DISTRICTS = [
  { name: 'Palm Heights', x0: 0, y0: 0, x1: 1500, y1: 800, tint: '#8fc97e', label: '#3d6b34' },
  { name: 'Downtown', x0: 1500, y0: 0, x1: 2700, y1: 1300, tint: '#b9c4cc', label: '#44525e' },
  { name: 'Market Quarter', x0: 0, y0: 1300, x1: 1500, y1: 2600, tint: '#e8c98a', label: '#7a5a22' },
  { name: 'Harbour', x0: 0, y0: 1300, x1: 900, y1: 2600, tint: '#9db8c9', label: '#2e4a5e' },
  { name: 'Beachfront', x0: 2700, y0: 0, x1: 3600, y1: 2600, tint: '#f2dd9e', label: '#8a6d2f' },
];

// The Harbour district overlaps the Market Quarter on paper; the harbour wins
// on the west strip, so give it priority when a point is in both.
export function districtAt(x, y) {
  if (x < 900 && y >= 1300) return DISTRICTS[3];
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[1];
}

export const PALETTE = {
  grass: '#7fae62',
  sand: '#ecd28a',
  sea: '#2f7fb8',
  seaDeep: '#1f5f92',
  road: '#3c3f45',
  roadLine: '#e8d44d',
  sidewalk: '#b7b0a0',
  park: '#5d9b4a',
  buildingRoof: '#8a7f72',
  carColors: ['#c0392b', '#2e6fb0', '#e0a030', '#7d8a99', '#4caf6d', '#8e44ad', '#e67e22'],
  pedColors: ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1'],
  player: '#ff7f2a',
  police: '#1c2733',
  policeLight: '#ff2d2d',
  policeLight2: '#2d7bff',
};

export const TUNING = {
  walkSpeed: 210,
  runSpeed: 320,
  carAccel: 420,
  carBrake: 620,
  carMaxSpeed: 560,
  carReverseMax: 180,
  carTurn: 2.6,
  carGrip: 0.94,
  handbrakeGrip: 0.82,
  trafficSpeed: 150,
  pedSpeed: 55,
  pedFleeSpeed: 170,
  officerSpeed: 235,
  policeCarSpeed: 620,
  bulletSpeed: 950,
  bulletRange: 620,
  shotCooldown: 0.28,
  magSize: 12,
  startReserve: 48,
  playerMaxHp: 100,
  hpRegen: 2.5,
  wantedDecaySeconds: 18,
  maxWanted: 5,
  bustFine: 200,
  wastedLoss: 150,
  stealHeat: 1,
  pedHitHeat: 1,
  shotHeat: 0.25,
  copHarmHeat: 1,
  pickupRespawn: 25,
  clockStartMinutes: 9 * 60,
  clockMinutesPerSecond: 0.5,
};

export const CAR_MODELS = [
  { name: 'Hatch', len: 46, wid: 24, top: 0.55 },
  { name: 'Sedan', len: 54, wid: 26, top: 0.5 },
  { name: 'Van', len: 60, wid: 28, top: 0.45 },
  { name: 'Sport', len: 50, wid: 25, top: 0.6 },
  { name: 'Taxi', len: 54, wid: 26, top: 0.5 },
];
