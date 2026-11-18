// Games register themselves here. To add a game, create app/games/my-game.js,
// call Games.register({...}) and add a <script> tag to index.html.
//
// A game looks like:
//   Games.register({
//     id: 'my-game', name: 'My Game', emoji: '🚀', color: '#ff9f1c',
//     create(api) {            // api: { w, h, input, sfx, fx, celebrate() }
//       return {
//         update(dt) {},       // called every frame with seconds since last frame
//         draw(ctx) {},        // draw the whole scene (background included)
//         resize() {},         // optional: api.w / api.h changed
//         destroy() {},        // optional: cleanup when leaving
//       };
//     },
//   });
const Games = {
  list: [],
  register(game) { this.list.push(game); },
};
