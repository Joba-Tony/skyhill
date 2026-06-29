// main.js — Phaser 游戏入口
import { COLORS } from './ui.js';
import { game, GameState, RNG, classById } from './state.js';
import * as Data from './data.js';
import * as CombatMath from './combat.js';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { ClassSelect } from './scenes/ClassSelect.js';
import { Base } from './scenes/Base.js';
import { Explore } from './scenes/Explore.js';
import { Combat } from './scenes/Combat.js';
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
  scene: [Boot, Menu, ClassSelect, Base, Explore, Combat, Inventory, Craft, LevelUp, Shop, GameOver],
};

const phaserGame = new Phaser.Game(config);
phaserGame.gameState = game; // 便于调试：window 上可访问
// 暴露给调试 / 平衡模拟器
window.__SKYHILL__ = { game, phaserGame, GameState, RNG, classById, Data, CombatMath };
