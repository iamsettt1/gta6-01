// Solmar Bay's story: Milo Reyes comes home owing money to club owner Vince
// Marlowe and works it off job by job, with fixer Cassie Vale on the phone and
// driver Big T Okafor riding shotgun. Six missions, each a list of steps the
// world checks off; a step is a place to reach, a car to take, a package to
// grab, a chase to survive or a getaway to make.
export const MISSIONS = [
  {
    id: 'm1',
    title: 'Welcome Back',
    reward: 400,
    briefing: 'Cassie: "Milo! You are back in Solmar Bay. Vince owns your debt now. Come see me at the garage on Palm Row — and grab a car, any car. This city runs on wheels."',
    steps: [
      { type: 'steal', text: 'Take a car — walk up to one and press E', reward: 100 },
      { type: 'goto', x: 1500, y: 2050, radius: 90, text: 'Drive to Cassie\'s garage on Palm Row', reward: 300 },
    ],
  },
  {
    id: 'm2',
    title: 'The Harbor Pickup',
    reward: 700,
    briefing: 'Cassie: "A crate came in at the Old Harbor docks. Pick it up and bring it to the diner on Neon Mile. No cops, no drama — Vince hates drama."',
    steps: [
      { type: 'goto', x: 300, y: 700, radius: 90, text: 'Pick up the crate at the Old Harbor docks', reward: 200 },
      { type: 'goto', x: 1500, y: 1150, radius: 90, text: 'Deliver the crate to the Neon Mile diner', reward: 500 },
    ],
  },
  {
    id: 'm3',
    title: 'Getaway Driver',
    reward: 1200,
    briefing: 'Big T: "I lifted a watch from a guy who lifts watches. The Solmar Bay PD is on me. Come get me at Marina Heights and drive like the bay is on fire."',
    steps: [
      { type: 'goto', x: 2700, y: 250, radius: 90, text: 'Pick up Big T at Marina Heights', reward: 200 },
      { type: 'chase', seconds: 25, text: 'Escape the police — lose the wanted level or outrun them', reward: 1000 },
    ],
  },
  {
    id: 'm4',
    title: 'Repo Run',
    reward: 1500,
    briefing: 'Cassie: "A gold Comet GT is parked outside the Grand Hotel on the Mile. Its owner stopped paying. Take it — gently, it is worth more than both of us — and bring it to the garage."',
    steps: [
      { type: 'steal', x: 2100, y: 1150, radius: 130, text: 'Steal the gold Comet GT outside the Grand Hotel', reward: 300 },
      { type: 'goto', x: 1500, y: 2050, radius: 90, text: 'Deliver the Comet GT to Cassie\'s garage', reward: 1200 },
    ],
  },
  {
    id: 'm5',
    title: 'Heat Wave',
    reward: 2000,
    briefing: 'Vince: "The PD put a price on your head, Milo. Three stars and counting. Survive the heat for a minute — if you can lose them, the debt shrinks. If you can\'t, it doesn\'t matter."',
    steps: [
      { type: 'chase', seconds: 45, text: 'Survive the police chase — stay alive and keep moving', reward: 2000 },
    ],
  },
  {
    id: 'm6',
    title: 'The Grand Job',
    reward: 5000,
    briefing: 'Cassie: "Last one. The Solmar Grand vault, midnight. Grab the take, then run for the boat at Sunset Beach. Do this and Vince tears up your debt. Do this and you are free."',
    steps: [
      { type: 'goto', x: 2700, y: 700, radius: 100, text: 'Reach the Solmar Grand and grab the take', reward: 1000 },
      { type: 'escape', x: 900, y: 2500, radius: 110, text: 'Escape to the boat at Sunset Beach — 4 stars on you', reward: 4000 },
    ],
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

// The next mission the player has not finished yet, or null when the story is done.
export function nextMission(completedIds) {
  for (const m of MISSIONS) if (!completedIds.includes(m.id)) return m;
  return null;
}
