// Tweak these without touching game code.
window.CONFIG = {
  voice: true,            // speak game names on the menu (uses the Mac's built-in voices); games never talk
  voiceLang: 'en-GB',     // e.g. 'es-ES' for Spanish
  volume: 0.7,            // master volume 0..1
  rumble: true,           // controller vibration, if supported
  backHoldSeconds: 1.2,   // how long SELECT + START must be held to return to the menu
  stickSpeed: 1.0,        // multiply movement speed (lower = calmer)
  showGuides: true,       // small controller map in the corner of Dino World / Tractor Farm (for grown-ups)

  // Text the voice says. Swap these for another language if you like.
  words: {
    welcome: 'Pick a game!',
  },
};
