// main.js — 末世幸存者 入口
import { Boot } from './game/Boot.js';
import { Menu } from './game/Menu.js';
import { Game } from './game/Game.js';
import { Upgrade } from './game/Upgrade.js';
import { GameOver } from './game/GameOver.js';
import { PAL } from './game/data.js';

const config = {
  type: Phaser.AUTO,
  width: 960,
  height: 600,
  parent: 'game',
  backgroundColor: PAL.bg,
  render: { antialias: true, roundPixels: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, Menu, Game, Upgrade, GameOver],
};

const phaserGame = new Phaser.Game(config);
window.__MW__ = { game: phaserGame };

// ---- 修正指针坐标错位（外层 CSS 缩放/预览窗口/iframe 会让 Phaser 的输入映射出错）----
// 每帧 + 每次指针事件捕获阶段，用画布真实 getBoundingClientRect 覆盖 Phaser 的 displayScale 与边界。
function fixInputMapping() {
  try {
    const sm = phaserGame.scale;
    const rect = phaserGame.canvas.getBoundingClientRect();
    if (rect.width > 2 && rect.height > 2) {
      sm.displayScale.set(sm.gameSize.width / rect.width, sm.gameSize.height / rect.height);
      if (sm.canvasBounds && sm.canvasBounds.setTo) sm.canvasBounds.setTo(rect.x, rect.y, rect.width, rect.height);
      const im = phaserGame.input && phaserGame.input.manager;
      if (im) { im.bounds = rect; im.dirty = true; }
    }
  } catch (e) {}
}
let _lastFix = 0;
window.addEventListener('pointerdown', fixInputMapping, true);
window.addEventListener('pointermove', () => { const n = Date.now(); if (n - _lastFix > 80) { _lastFix = n; fixInputMapping(); } }, true);
phaserGame.events.on('prestep', fixInputMapping);
['resize', 'orientationchange', 'load'].forEach(ev => window.addEventListener(ev, () => { try { phaserGame.scale.refresh(); fixInputMapping(); } catch (e) {} }));
document.addEventListener('visibilitychange', () => { try { phaserGame.scale.refresh(); } catch (e) {} });
