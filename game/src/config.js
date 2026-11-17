// Solmar Bay — tuning constants. One place for every number the game balances on:
// world size, speeds, wanted heat, police, combat and the mission clock.
export const STEP = 1 / 60;

export const WORLD = {
  width: 3600,
  height: 2600,
  roadWidth: 96,
  // Avenue x-centres (vertical roads) and street y-centres (horizontal roads).
  avenues: [300, 900, 1500, 2100, 2700, 3300],
  streets: [250, 700, 1150, 1600, 2050, 2400],
  // Beach band along the south edge, then the sea.
  beachTop: 2450,
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 175,
  runSpeed: 275,
  health: 100,
  punchDamage: 18,
  punchRange: 36,
  punchArc: 1.1,
  pistolDamage: 34,
  pistolRange: 480,
  pistolAmmo: 24,
  pistolMaxAmmo: 48,
  reloadSeconds: 1.1,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 430,
  brake: 640,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 3.4,
  handbrakeGrip: 0.7,
};

export const TRAFFIC = {
  count: 26,
  pedCount: 42,
  carSpeed: 150,
  pedSpeed: 55,
};

// Wanted heat: 0..100. Stars = ceil(heat / 20), 0 while heat < 8.
export const CRIME_HEAT = {
  stealCar: 22,
  hitPed: 14,
  killPed: 26,
  shoot: 8,
  killCop: 30,
  ramCop: 12,
  decayPerSecond: 1.6,
  calmSeconds: 8,
};

export const POLICE = {
  // police cars + foot officers fielded per wanted star count
  carsPerStar: [0, 1, 2, 2, 3, 4],
  officersPerStar: [0, 0, 1, 2, 3, 4],
  carSpeed: 505,
  officerSpeed: 208,
  officerHealth: 50,
  shootRange: 380,
  shootCooldown: 1.15,
  bulletDamage: 9,
  bustSeconds: 1.6,
  bustRange: 30,
};

export const CLOCK = {
  // One in-game hour every 40 real seconds; the day starts at 09:12.
  secondsPerHour: 40,
  startHour: 9,
  startMinute: 12,
};

export const SAVE_KEY = 'solmarbay.save.v1';
export const BEST_KEY = 'solmarbay.best.v1';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
