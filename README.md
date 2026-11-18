# Tiny Arcade 🎮

Gentle 3D controller games for a little player (around age 3), built with Electron and Three.js.
Dinosaur models: [Animated LowPoly Dinosaurs](https://quaternius.itch.io/animated-lowpoly-dinosaurs) by Quaternius (CC0).
Scenery: Simple Nature Pack (trees, bushes, rocks, grass: Tractor Farm, Dino World, Balloon Pop) and Modular Medieval
Buildings (castles, towers, watchtowers: Dragon Sky) by Quaternius (CC0).
Made for 8BitDo controllers, but any gamepad works. The keyboard works too.

## Run it

```bash
npm install
npm start          # fullscreen
npm run dev        # in a window (handy while building)
npm run dist       # build a Mac .dmg into dist/
```

Requires Node 18 or newer. While developing you can jump straight into a game by opening
`app/index.html#dino-world` (or any game id) in Chrome. Click once to enable sound in a browser.

## Connecting the 8BitDo

- Pair over Bluetooth in **X-input mode** (on most models: hold **Start + X** while powering on), or plug in with USB-C.
- Press any button once the app is open. The menu shows "🎮 Controller ready" when it's detected.
- Buttons are read by **position**, so Switch-style labels (A/B/X/Y swapped) don't matter:
  bottom, right, left, top face buttons; L / R shoulders; ZL / ZR (L2 / R2) triggers.

## Grown-up controls

| Action | How |
|---|---|
| Back to the menu | Hold **SELECT + START** (− and + on Switch layouts) for about a second, or press **Esc** |
| Toggle fullscreen | **Esc** on the menu |
| Quit | **Cmd + Q** |

Toddlers can't leave a game by accident: only the two-button hold or the keyboard does that.

## The games

| Game | What happens |
|---|---|
| 🎉 **Button Party** | Disco room. Every press launches a bouncy toy that piles up; the floor tiles light up. The stick rolls the smiley buddy, which can bump into the pile. |
| 🥁 **Drum Band** | Concert stage. Four drums sit where the face buttons are. **L/R** crash the cymbals, **ZL/ZR** fire confetti cannons. The dino dances to every hit, and the crowd jumps. |
| 🐠 **Fishy Swim** | Underwater. Steer to the stars; new fish friends join every 5 stars. Any button blows bubbles. |
| 🎈 **Balloon Pop** | Meadow. Fly the magic star to a balloon and press any button to pop it. |
| 🦖 **Dino World** | Endless meadow as a T-rex. Walk anywhere. Each spotted egg hatches a different baby dino (Triceratops, Stegosaurus, Raptor...) who follows you and copies what you do. |
| 🚜 **Tractor Farm** | Endless farm. Drive anywhere. Animals hop and call out; pumpkins get pushed around. Drive into a hay bale with the bucket down to scoop it up, press the top button to tip it out; drop it on another bale to build a stack (confetti at three high). |
| 🏗️ **Sand Digger** | Endless sandy yard in a big wheel loader. Drive the bucket into a brown dig mound to fill it, press the bottom button to tip it out: dumping on the same spot builds a taller and taller sand pile (flag at 5 loads, sparkles and confetti after that). |
| 🐉 **Dragon Sky** | Fly a friendly green dragon over an endless land of hills, castles and floating lanterns. Breathe fire to light paper lanterns (they glow and float away), campfires and castle braziers; everything goes out again after a while so there is always more to light. |

### Dino World buttons

| Button | Action |
|---|---|
| Stick / D-pad | Walk (push further to run) |
| Bottom | Jump |
| Right | ROAR |
| Left | Sneeze |
| Top | Dance |
| L / R | Wave left / right hand |
| ZL / ZR | Lift left / right leg, then STOMP |

### Tractor Farm buttons

| Button | Action |
|---|---|
| Stick up / down | Drive forward / reverse |
| Stick left / right | Steer |
| ZR / ZL (hold) | Forward / reverse |
| Bottom | Jump |
| Right | Beep-beep horn (animals react) |
| Left | Lights on/off (the farm turns to sunset) |
| Top | Raise / lower the front bucket (carrying a hay bale: tip it out) |
| L / R | Left / right blinkers |

### Sand Digger buttons

| Button | Action |
|---|---|
| Stick up / down | Drive forward / reverse (backup beeper) |
| Stick left / right | Steer (the loader bends in the middle) |
| ZR / ZL (hold) | Forward / reverse |
| Bottom | Dump the sand (empty bucket: a shake) |
| Right | Horn |
| Left | Flashing beacon on/off |
| Top | Lift / lower the bucket arm |
| L / R | Bounce |

### Dragon Sky buttons

| Button | Action |
|---|---|
| Stick left / right | Turn |
| Stick up / down | Fly higher / lower |
| ZR / ZL (hold) | Fly fast / slow |
| Bottom (hold) | Breathe fire |
| Right | ROAR |
| Left | Loop-the-loop |
| Top | Big flap (shoots upward) |
| L / R | Barrel roll left / right |

The free-roam games show a small controller map in the corner for grown-ups (`showGuides` in config).

Design rules every game follows: no losing, no timers, no reading needed, any button does something, generous targets, and no voices praising or talking during play.

## Settings

Edit `app/config.js`:

- `voice`, `voiceLang`: spoken game names on the menu only (set `voice: false` to silence)
- `volume`, `rumble`, `stickSpeed`, `backHoldSeconds`, `showGuides`

## How it's built

```
main.js               Electron window (fullscreen, sound without a click, no screen sleep)
preload.js            small bridge for quit / fullscreen
app/index.html        loads everything; game order = menu order
app/config.js         settings
app/core/input.js     all controllers + keyboard merged into one friendly "pad"
app/core/audio.js     every sound is synthesised (drums, roar, horn, moo, engine...)
app/core/three-kit.js shared 3D toolkit (see below)
app/core/assets.js    parses the packed 3D models at startup (Assets.ready / Assets.get)
app/assets/dinos/     the six dinosaurs: .glb (source) + .glb.js (packed, what the app loads)
app/core/shell.js     menu + game loop
app/games/            one file per game
app/vendor/           Three.js bundle (window.THREE)
tools/three-entry.js  what goes into the bundle, rebuilt with `npm run vendor`
tools/pack-assets.js  wraps every .glb into a .glb.js (`npm run assets`)
tools/fbx-to-glb/     drag-and-drop FBX → GLB converter page (open index.html in Chrome)
```

No build step. Sounds, textures and scenery are generated in code; the only files are the dinosaur models.

### The 3D kit (`Kit3D`)

- `Kit3D.stage(api, opts)` gives a renderer, scene, camera, soft environment lighting, shadows, bloom + vignette,
  a particle pool (`S.sparkle`), floor shockwaves (`S.ring`), camera shake, `S.toScreen()` for 2D overlays, and cleanup.
  3D games render to their own canvas underneath the 2D canvas, which they use for the HUD.
- `Kit3D.sky`, `Kit3D.sun`: gradient sky dome with a sun disc; sun with soft shadows that can follow the player.
- `Kit3D.makeDinoModel(S, 'trex' | 'triceratops' | ..., { height, palette })`: a model dinosaur with a rig:
  `rig.do('roar' | 'jump' | 'dance' | 'waveL' | 'legR' | 'sneeze' | 'clap' | 'spin' | ...)`. Idle/walk/run/jump/roar come
  from the model's own animation clips; the other actions rotate bones on top of them (see "3D models" below).
  Species settings (size, bright colours, cartoon head/arm scale) live in `Kit3D.DINO_SPECIES`.
  `Kit3D.makeDino` is the original bubble dino, used automatically if a model is missing.
- `Kit3D.infiniteGround` + `Kit3D.scatter`: the endless-world trick. The ground follows the player while its texture
  stays put, and props wrap around a square centred on the player, hidden by fog.
- `Kit3D.decals` (footprints, tyre tracks) and `Kit3D.drawGuide` (the corner controller map).

Lighting tip learned the hard way: glossy clearcoat on big flat surfaces mirrors the studio environment and blooms
into a white glow. Use satin materials (`roughness` around 0.5) for flat panels and keep clearcoat for round things.

## 3D models

The app loads models from `app/assets/` as packed scripts, because Electron can't `fetch()` local files from `file://`.

To add a model (or another Quaternius pack):
1. Get a `.glb`. For FBX files, open `tools/fbx-to-glb/index.html` in Chrome and drop the FBX files in.
   It fixes the too-dark FBX colours, merges ~160 colour patches into a few draw calls, and names clips "Walk", "Run" etc.
   From Blender: *File → Export → glTF 2.0 (.glb)* with animations ticked.
2. Put it in `app/assets/<folder>/name.glb` and run `npm run assets`.
3. Add `<script src="assets/<folder>/name.glb.js"></script>` to `app/index.html` (before `core/assets.js`).
4. Use it: `Assets.get('<folder>/name')` gives `{ scene, animations }`. Clone rigged models with
   `THREE.SkeletonUtils.clone(scene)` and play clips with a `THREE.AnimationMixer`. For another dinosaur from the same pack,
   add an entry to `Kit3D.DINO_SPECIES` and `Kit3D.makeDinoModel(S, 'name')` does the rest.

How the dino actions work: the Quaternius rigs have bones named `Head`, `Neck`, `FrontUpLegL/R`, `BackUpLegL/R`,
`Tail1-5`, and separate "foot target" bones under `root`. The rig rotates bones around the *dino's own* axes
(forward, up, left) so it doesn't depend on each bone's local axes, and moves the foot target along with a lifted leg
so the foot stays attached. Walk/run speed up with the stick so the feet don't slide.

Skinned meshes have unreliable bounding boxes, so models are measured from their actually skinned vertices
(this is what fixed the floating Triceratops).

## Adding a game

1. Create `app/games/my-game.js`:

```js
Games.register({
  id: 'my-game', name: 'My Game', emoji: '🚀', color: '#ff9f1c',
  create(api) {
    const S = Kit3D.stage(api, { fog: ['#cdeeff', 30, 70] });
    // ...build the scene with S.scene / S.mat / S.mesh / S.geo...
    return {
      update(dt) { /* api.input.x/.y, api.input.pressed[], api.sfx.*, then */ S.update(dt); },
      draw(ctx)  { S.render(); ctx.clearRect(0, 0, api.w, api.h); /* 2D HUD */ },
      resize: S.resize,
      destroy: S.destroy,
    };
  },
});
```

2. Add `<script src="games/my-game.js"></script>` to `app/index.html`, above `core/shell.js`.
3. Menu icon: in `create`, set `S.hero = myHeroObject` (or a function returning a list of objects; it may pose them),
   add the game to `VIEWS` in `tools/make-icons.js`, then run `npm run icons`. It renders the hero in 3D to
   `app/assets/icons/my-game.png`; until then the menu shows the emoji.
