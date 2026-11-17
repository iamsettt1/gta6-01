# Solmar Bay — Streets of the Sun

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/iamsettt1/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/iamsettt1/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

**Solmar Bay** is a sun-soaked coastal city of five districts — Old Harbor, Marina Heights, Neon Mile, Palm Row and Industrial Flats, plus Sunset Beach. Milo Reyes is back home and club owner Vince Marlowe owns his debt. Six story missions stand between Milo and freedom: a harbor pickup, a getaway drive, a repo run for a gold Comet GT, a heat wave of police pursuit, and the Grand Job at the Solmar Grand.

## The game

- **Open world on foot and by car** — explore 3,600 × 2,600 streets on foot (WASD, Shift to run) or behind the wheel (WASD to drive, Space for the handbrake, E to enter and exit cars).
- **Traffic and pedestrians** — cars drive the road grid and stop for each other; crowds walk the sidewalks and flee when the heat rises.
- **Cars to steal** — walk up to any parked or traffic car and press E. The driver runs; the police notice.
- **Wanted level** — 1–5 stars that rise on car theft, hitting pedestrians, shooting and killing officers, and cool off when you lay low. Police cars chase and ram; officers on foot chase, shoot and arrest.
- **Missions and a story** — six missions with briefings, dialogue, objectives, markers and cash rewards (press J for the mission menu). Progress, cash and best stats save to localStorage.
- **Combat** — fists (F) and a pistol (mouse aim, click to shoot, R to reload) with ammo, enemy health and a health bar that recovers when you are safe.
- **HUD with a live minimap** — wanted stars, health, cash, the in-game clock, district name, speed, ammo, mission objective and a minimap with player, police and mission markers.
- **Sound, synthesized** — engine hum, sirens, gunshots, pickup blips and a bassline loop, all WebAudio. M for mute.
- **Menus** — title screen with the story, pause, mission select, Busted and Wasted screens, restart.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network requests — everything is a file under `game/`.

## Shots

The `?shot=start|play|end` scenes stage real gameplay (the play scene's autopilot steals a car and drives the road grid to the mission marker while the police close in) and set `window.__shotReady` when painted. See `shots.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=9j3w1sg2&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
