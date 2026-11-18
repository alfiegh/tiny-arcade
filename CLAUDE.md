# Tiny Arcade: notes for AI coding sessions

Gentle 3D gamepad games for a 3-year-old learning an 8BitDo controller. Electron + Three.js, plain JS, **no build step**.
README.md has the full user-facing docs; this file is the short version for working on the code.

## Run / test
- `npm start` (fullscreen) · `npm run dev` (windowed) · `npm run dist` (Mac .dmg)
- Jump straight into a game: open `app/index.html#<game-id>` (e.g. `#dino-world`) in Chrome or Electron.
- In a plain browser, click once to enable sound (Electron allows autoplay via `autoplayPolicy`).
- `window.__stage` = the current 3D game's Kit3D stage (scene, camera…) for DevTools poking.
- Test without hardware: override `navigator.getGamepads` to return a fake pad (`{ mapping:'standard', axes:[0,0,0,0], buttons:[{pressed,value}×17] }`).

## Layout
```
main.js / preload.js     Electron window + tiny quit/fullscreen bridge
app/index.html           script tags; game order here = menu order
app/config.js            settings (voice, volume, rumble, stickSpeed, backHoldSeconds, showGuides)
app/core/input.js        all pads + keyboard merged: Input.x/.y, .pressed[], .actions[], .down, .rumble()
app/core/audio.js        Sfx: every sound synthesised (note, pop, drum, roar, horn, moo, engine()…)
app/core/fx.js           2D particles/confetti/floating emoji on the overlay canvas
app/core/three-kit.js    Kit3D: stage, sky, sun, makeDinoModel, infiniteGround, scatter, decals, drawGuide, prop
app/core/assets.js       parses packed models: Assets.ready, Assets.get('dinos/trex')
app/core/shell.js        menu carousel + game loop + loading screen (#loader) + parent exit (hold SELECT+START / Esc)
app/games/*.js           one file per game, each calls Games.register({ id, name, emoji, color, create(api) })
app/assets/dinos/        Quaternius CC0 dinos: .glb (source) + .glb.js (packed; what the app loads)
app/assets/bulldozer/    "Wheel loader" model for Sand Digger (textures embedded in the .glb)
app/assets/dragon/       rigged dragon for Dragon Sky (from "Dragon Rigged and Game Ready" Unity package FBX)
app/assets/nature/       Quaternius Simple Nature (Tree1-4, Bush1-3, Rock1-3, Grass1-3) as one .glb, one named node per model
app/assets/medieval/     Quaternius Modular Medieval Buildings (towers, walls, Well, Banner...) the same way
                         use: Kit3D.prop(S, 'nature/nature', 'Tree1', { height, colors: { Celing: '#3d7bf0' } })
app/vendor/three.bundle.js  Three.js + addons as window.THREE (rebuild: edit tools/three-entry.js, `npm run vendor`)
tools/pack-assets.js     .glb -> .glb.js (`npm run assets`)
tools/fbx-to-glb/        drag-and-drop FBX->GLB converter page
```

## Game contract
`create(api)` returns `{ update(dt), draw(ctx), resize?, destroy? }`.
3D games: `const S = Kit3D.stage(api, opts)`; in `update` end with `S.update(dt)`; in `draw` call `S.render()` then
`ctx.clearRect(...)` and draw the 2D HUD; `resize: S.resize`; `destroy` must call `S.destroy()` (and stop `Sfx.engine()` etc.).
3D renders to its own canvas (`.gl-layer`) under the 2D `#stage` canvas.

## Rules (product)
- Age 3: no losing, no timers, no reading needed, generous targets/assists, every button does *something*.
- **No voices during play** (menu may speak game names only). No praise lines.
- Buttons are read by **position** (standard mapping): 0 bottom, 1 right, 2 left, 3 top, 4 L, 5 R, 6 ZL/L2, 7 ZR/R2,
  8 select, 9 start, 12–15 D-pad. Colours by position: `U.BTN_COLORS`. Never exit a game except via SELECT+START hold / Esc.
- Free-roam games (Dino World, Tractor Farm, Sand Digger, Dragon Sky) keep a fixed or chase camera: toddlers can't control a camera.

## Rules (rendering) learned the hard way
- The nature/medieval packs were built from the OBJ files (their .mtl colours were lost on export, so colours are set
  by material name: medieval `Celing` = roof, `LightRock`/`DarkRock` = stone, `Black` = window holes). Stone is a warm
  grey, not white, or it blooms. Only `Leaves` (grass blades are single planes) is double-sided: double-sided closed
  meshes get shadow acne.
- Game create() blocks the page; the loader is a DOM overlay with transform-only CSS animations so it keeps moving.
- Textures embedded in a .glb load via `blob:` URLs: the CSP in index.html must keep `img-src` and `connect-src` allowing
  `blob: data:`, or textured models silently render plain white. Test pages need the same CSP to catch this.
- Glossy clearcoat on **big flat surfaces** mirrors the studio environment and blooms white: use satin (`roughness ~0.5`).
- Bloom threshold ~1.15–1.3: only emissive things (stars, sparkles, lights) should glow.
- Skinned meshes: measure from skinned vertices (`applyBoneTransform`), not bounding boxes.
- Quaternius rigs: bones `Head`, `Neck`, `FrontUpLegL/R`, `BackUpLegL/R`, `Tail1-5`; foot targets are children of `root`.
  Rotate bones about the dino's own axes (forward +Z, up +Y, its left +X) via the rig's `rot`/`limb` helpers; move the foot
  target with a lifted leg. Walk/Run clips play in place; Jump clip lifts the body itself (landing time from `Assets` meta).
- Wheel loader .glb: bucket + link rod come out detached (bone-parented in Blender, no skins used). `buildLoader()` in
  sand-digger.js re-hinges the bucket at the arm tip, hides the rod, recolours the white mirror shaders. three.js strips
  dots from node names (`Plane.016` -> `Plane016`). `__stage.loader` exposes the rig.
- Dragon .glb was converted in Electron with three's FBXLoader + GLTFExporter: colour map (originally near-black) recoloured
  to flat cartoon greens with no pale highlights (a luminance ramp up to near-white made it look white in-game), vertices merged
  (FBX imports are unindexed: 9.4 MB -> 3.7 MB), and only one seamless hover loop (source Fly clip 1.43s-3.87s, which
  is take-off/hover/landing) kept as "Fly". The clip hovers upright, the game pitches it forward. Mouth = `upper_lip`/`lower_lip` bones.
- Additive sprites wash out against a bright sky; fire uses normal blending. Anything the chase camera can fly into
  (fire, lanterns, clouds) must fade/hide near the lens or it fills the screen white with bloom.
  A breath stream seen from straight behind collapses into a ball: Dragon Sky swings the camera to a 3/4 view while breathing.
- Infinite worlds: ground follows the player with texture offset; props wrap around a square (`scatter`, area ~130) hidden by fog (~36–66).

## Games (menu order)
button-party · drum-band · fishy-swim · balloon-pop · dino-world · tractor · sand-digger · dragon-sky

## Ideas not done yet
- Let the child choose their dino (every species works as the player: `Kit3D.makeDinoModel(S, 'triceratops')`).
- Big cartoon eyes attached to the dino `Head` bone.
- Fishy Swim still has its own renderer setup (predates Kit3D); could be ported to Kit3D.

## Working style for sessions
Small, targeted edits; don't rewrite whole files. Only take screenshots when a change is visual.
