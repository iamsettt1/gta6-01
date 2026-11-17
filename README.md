# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/iamsettt1/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/iamsettt1/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Bay — Streets of the Sun** is a complete 2D top-down open-world crime game, built from scratch for make.fun's "Make GTA 6" bounty. Everything is original: the city, the characters, the vehicles, the story, the art and the sounds.

Rio Calder just rolled into Solmar Bay with an empty wallet and a fast mouth. Lena Voss runs the crew that runs this town, and six jobs stand between Rio and the big time — if the police don't catch him first.

## What is in the game

- **A city to explore** — five districts (Palm Heights, Downtown, Market Quarter, Harbour, Beachfront) on a road grid with buildings, parks, street props, a beach and the sea.
- **On foot and by car** — walk and run with WASD, steal parked and traffic cars with E, drive with W/S to accelerate and brake, A/D to steer and Space as handbrake.
- **Traffic and pedestrians** — cars follow the road network and slow for each other; pedestrians walk the sidewalks and flee from gunfire, crashes and chases.
- **Wanted level and police** — 1–5 stars for stealing, hitting pedestrians, firing a weapon or harming police. On-foot officers chase and arrest you; police cars chase, ram and box you in. Wanted decays when you stay out of sight.
- **Combat** — a pistol aimed with the mouse, fired with a click, with limited ammo, reloads, muzzle flash, tracers, and health/ammo pickups around the city.
- **Missions and a story** — a six-job chain (delivery, car theft, getaway, on-foot chase, timed delivery, final heist) with briefings, map markers, rewards and a mission-complete banner.
- **HUD with minimap** — roads, player arrow, police markers, mission marker and north indicator, plus wanted stars, health, cash, ammo, speed and the in-game clock.
- **Menus and save** — start screen with the story and controls, pause, missions list, busted/wasted screens, and progress saved to localStorage.
- **Sound** — synthesised WebAudio only: engine hum, sirens, gunshots, pickup blips, a mission jingle and a looping music bed. M to mute. No audio files.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 and play. The game is plain static files under `game/` with no build step and no network requests. Deterministic screenshot scenes are available at `?shot=start|play|end&seed=N`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=9j3w1sg2&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
