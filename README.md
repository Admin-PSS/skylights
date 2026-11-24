# SkyLights — virtual drone light show

**Live demo:** https://admin-pss.github.io/skylights/ — every push to `main` is built and deployed automatically (GitHub Actions → Pages).

A browser app that simulates a drone light show over a virtual night-time city.

## Run
```
npm install
npm run dev        # open http://localhost:5173 (also reachable from your phone on the same Wi-Fi)
npm run build      # production build in dist/
```

## Install on a phone (home screen app)
SkyLights is a Progressive Web App: it installs on the home screen, opens full-screen and works offline.
Installing requires the built app to be served over **https** (any static host works — the `dist/` folder is self-contained):
- `npm run build`, then upload `dist/` to e.g. Netlify Drop, GitHub Pages, Cloudflare Pages or Vercel.
- Android (Chrome): open the https link → **📲 Install** button (View tab) or menu ⋮ → *Install app*.
- iPhone/iPad (Safari): open the link → Share □↑ → *Add to Home Screen*.

## Features
- Night city with lit windows, river reflections, bridge, stars and sweeping searchlights
- 500 – 4,000 drones; nearest-drone path assignment so flights don't tangle; unused drones go dark
- Formations: launch pad, lift-off grid, sphere, heart, star, DNA helix, galaxy, ring, cube, waving flag, starburst, custom text (incl. Myanmar script), image/logo, landing
- Festival formations: pagoda (zedi), Buddha in meditation, lotus, full moon, fire balloon,
  Matho Thingan weaving loom (animated: shuttle + cloth growing row by row) and robe offering
- Lasers per step: sweeping fans, beams aimed at drones, string-art web between drones
- Fireworks per step (some / finale) or on demand (🎆 button or G): peony, ring, willow, glitter, palm, double — with distance-delayed booms
- Full moon over the city, small sky lanterns drifting up
- မီးပုံးပျံ 3D fire balloons: paper balloons glowing from the flame inside, lantern balloons (sein na ban) covered in candles,
  fireworks balloons that rain spark cascades; mass launch per step, or press B
- Shwedagon-style golden stupa on a hill: floodlit gold, ring of small stupas, lit stairways, sparkling diamond orb (camera preset "Shwedagon")
- Show presets: Tazaungdaing Full Moon (default), City lights demo
- Light effects: gradient, rainbow, wave, twinkle, pulse rings, chase, strobe, solid, golden glitter, image colors
- Show timeline (play/pause/next, reorder, remove, loop) — saved in the browser
- Music: built-in demo beat, your own music file, or microphone; lights pulse and shift color on beats
- Video recording (Video tab, ⏺ or R): whole show or from now; 1080p landscape/vertical, 720p or screen size; MP4 where supported (else WebM), with music and firework sound; download or share
- Title card (Video tab): opening card (title, Burmese subtitle, date, “Presented by”), closing card, optional corner credit — drawn into the canvas so it is in the video
- Cameras: riverbank, aerial, rooftop, bridge, auto-orbit, free orbit/zoom (touch supported)

Keys: Space play/pause · ← → steps · G fireworks · B fire balloon · R record · H hide UI · F fullscreen

## Code map
- `src/main.js` — renderer, bloom, camera, main loop
- `src/scene/` — sky, city, river, spotlights, lasers, fireworks, moon & lanterns (`festival.js`), golden stupa (`shwedagon.js`)
- `src/drones/` — formations, light effects, swarm flight engine
- `src/show/show.js` — show timeline
- `src/audio/audio.js` — music input, demo beat, beat detection
- `src/ui/ui.js` — control panel
