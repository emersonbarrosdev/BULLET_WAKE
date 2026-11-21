/** Isolated browser harness only. Mobile development builds never mount the player's DEV panel. */
export function qaGameAccess() {
  return {
    name: 'qa-game-access',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/main.ts')) return;
      return code.replace('const game = new Phaser.Game(config);', 'const game = new Phaser.Game(config); window.__GAME__ = game;');
    },
  };
}
