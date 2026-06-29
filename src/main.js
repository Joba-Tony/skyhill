// main.js — Phaser 游戏入口
import { COLORS } from './ui.js';
import { game, GameState, RNG, classById } from './state.js';
import * as Data from './data.js';
import * as CombatMath from './combat.js';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { ClassSelect } from './scenes/ClassSelect.js';
import { Base } from './scenes/Base.js';
import { Field } from './scenes/Field.js';
import { Inventory } from './scenes/Inventory.js';
import { Craft } from './scenes/Craft.js';
import { LevelUp } from './scenes/LevelUp.js';
import { Shop } from './scenes/Shop.js';
import { GameOver } from './scenes/GameOver.js';

const config = {
  type: Phaser.AUTO,
  width: 960,
  height: 600,
  parent: 'game',
  backgroundColor: COLORS.bg,
  pixelArt: true,           // 像素素材最近邻缩放，保持锐利
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [Boot, Menu, ClassSelect, Base, Field, Inventory, Craft, LevelUp, Shop, GameOver],
};

const phaserGame = new Phaser.Game(config);
phaserGame.gameState = game; // 便于调试：window 上可访问
// 暴露给调试 / 平衡模拟器
window.__SKYHILL__ = { game, phaserGame, GameState, RNG, classById, Data, CombatMath };

// 修正指针坐标错位。
// 根因：当画布被「外层 CSS transform/缩放」（如 IDE/网页预览窗口、iframe 缩放）放大或缩小时，
// Phaser 计算指针用的缩放系数来自它自己设置的 CSS 尺寸（不含外层 transform），导致点击坐标被错算
// （表现为只有按钮某个角能点中）。scale.refresh() 不解决此问题。
// 修法：每次指针事件的「捕获阶段」（先于 Phaser 的监听），用画布真实的 getBoundingClientRect()
// （已包含外层 transform）直接覆盖 Phaser 的输入缩放系数与边界。
function fixInputMapping() {
  try {
    const sm = phaserGame.scale;
    const rect = phaserGame.canvas.getBoundingClientRect();
    if (rect.width > 2 && rect.height > 2) {
      // 缩放系数用真实渲染尺寸
      sm.displayScale.set(sm.gameSize.width / rect.width, sm.gameSize.height / rect.height);
      // 偏移量用真实位置（含外层 transform 造成的平移）
      if (sm.canvasBounds && sm.canvasBounds.setTo) sm.canvasBounds.setTo(rect.x, rect.y, rect.width, rect.height);
      const im = phaserGame.input && phaserGame.input.manager;
      if (im) { im.bounds = rect; im.dirty = true; }
    }
  } catch (e) {}
}
let _lastFix = 0;
window.addEventListener('pointerdown', fixInputMapping, true);
window.addEventListener('pointermove', () => { const n = Date.now(); if (n - _lastFix > 80) { _lastFix = n; fixInputMapping(); } }, true);
// 每帧在 Phaser 处理输入前重设，确保不被其内部重算覆盖（兜底所有外层缩放情形）
phaserGame.events.on('prestep', fixInputMapping);
// 合法的窗口尺寸变化仍走标准刷新
const refreshScale = () => { try { phaserGame.scale.refresh(); fixInputMapping(); } catch (e) {} };
window.addEventListener('resize', refreshScale);
window.addEventListener('orientationchange', refreshScale);
window.addEventListener('load', refreshScale);
document.addEventListener('visibilitychange', refreshScale);
