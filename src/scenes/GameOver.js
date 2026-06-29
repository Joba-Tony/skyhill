// GameOver — 结算（通关逃生 / 阵亡）
import { COLORS, txt, button, sprite, SFX, hex } from '../ui.js';
import { FRAMES } from '../data.js';
import { game, GameState } from '../state.js';

export class GameOver extends Phaser.Scene {
  constructor() { super('GameOver'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const won = game.won;
    this.cameras.main.setBackgroundColor(won ? 0x16241a : 0x241616);

    if (won) SFX.win(); else SFX.die();

    txt(this, W / 2, 120, won ? '🎉 成功逃生！' : '💀 你倒下了', 48, won ? hex(COLORS.good) : hex(COLORS.bad)).setOrigin(0.5);
    txt(this, W / 2, 180,
      won ? '你冲出了 SkyHill 酒店，活着见到了天光。'
          : `你在第 ${game.floor} 层倒下，再也没能离开。`,
      18, COLORS.text).setOrigin(0.5);

    sprite(this, W / 2, 280, won ? game.frame : FRAMES.ghoul, 6);

    // 战绩
    const stats = [
      `职业：${game.className}　等级 Lv${game.level}`,
      `下降层数：${game.descended} / ${100 - 1}`,
      `抵达楼层：${game.floor} 层`,
      `存活天数：${game.day} 天`,
      `击杀怪物：${game.kills}`,
    ];
    stats.forEach((s, i) => txt(this, W / 2, 360 + i * 26, s, 16, COLORS.text).setOrigin(0.5));

    button(this, W / 2 - 130, H - 80, 240, 50, '再来一局', () => { GameState.clearSave(); this.scene.start('ClassSelect'); },
      { fill: COLORS.accentDim, hover: COLORS.accent, size: 18 });
    button(this, W / 2 + 130, H - 80, 240, 50, '返回主菜单', () => { GameState.clearSave(); this.scene.start('Menu'); }, { size: 18 });

    // 通关存档清除（不可继续）
    GameState.clearSave();
  }
}
