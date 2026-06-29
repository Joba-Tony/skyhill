// Base — 顶层安全屋（休整中枢：睡觉 / 工作台 / 炉灶 / 背包 / 下楼探索）
import { COLORS, txt, button, sprite, panel, SFX, hex } from '../ui.js';
import { FRAMES } from '../data.js';
import { game } from '../state.js';
import { makeHUD } from '../hud.js';

export class Base extends Phaser.Scene {
  constructor() { super('Base'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.hud = makeHUD(this, game);

    txt(this, W / 2, 112, '顶层套房 · 安全屋', 22, hex(COLORS.accent)).setOrigin(0.5);

    // 房间布景
    this.drawRoom(W, H);

    // 日志面板
    panel(this, 24, 150, 360, 250, { fill: COLORS.panel });
    txt(this, 40, 162, '日志', 14, COLORS.muted);
    this.logLines = [];
    this.logText = txt(this, 40, 188, '', 13, COLORS.text).setWordWrapWidth(330).setLineSpacing(5);
    this.log('你回到安全屋。整理一下，准备继续下潜。');

    // 操作按钮
    const bx = W - 220, bw = 380;
    const acts = [
      ['😴 睡觉（恢复体力/HP）', () => this.sleep()],
      ['🔧 工作台（合成）', () => this.openCraft('workbench')],
      ['🍳 炉灶（烹饪）', () => this.openCraft('stove')],
      ['🎒 背包', () => this.openInventory()],
    ];
    let by = 170;
    acts.forEach(([label, fn]) => {
      button(this, W - 200, by, 360, 46, label, fn, { size: 16 });
      by += 56;
    });

    // 下楼探索（主行动）
    button(this, W - 200, by + 10, 360, 60, '⬇  下楼探索', () => this.descend(),
      { fill: COLORS.accentDim, hover: COLORS.accent, size: 22 });

    button(this, 80, H - 36, 130, 36, '主菜单', () => this.scene.start('Menu'), { size: 14 });
    button(this, 230, H - 36, 130, 36, '放弃逃生', () => this.giveUp(), { size: 14, fill: COLORS.panel });

    // 从覆盖层返回时刷新
    this.events.on('resume', () => this.hud.refresh());
  }

  drawRoom(W, H) {
    const baseY = H - 170, startX = 70;
    // 地板
    for (let i = 0; i < 8; i++) sprite(this, startX + i * 48, baseY + 40, FRAMES.floor, 3);
    // 家具
    const bed = sprite(this, startX + 30, baseY, FRAMES.bed, 3.4);
    txt(this, startX + 30, baseY + 30, '床', 12, COLORS.muted).setOrigin(0.5);
    sprite(this, startX + 130, baseY, FRAMES.anvil, 3.4);
    txt(this, startX + 130, baseY + 30, '工作台', 12, COLORS.muted).setOrigin(0.5);
    sprite(this, startX + 230, baseY, FRAMES.altar, 3.4);
    txt(this, startX + 230, baseY + 30, '炉灶', 12, COLORS.muted).setOrigin(0.5);
    // 角色站位
    this.hero = sprite(this, startX + 330, baseY, game.frame, 3.6);
    this.tweens.add({ targets: this.hero, y: baseY - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  log(msg) {
    this.logLines.push(msg);
    if (this.logLines.length > 9) this.logLines.shift();
    this.logText.setText(this.logLines.join('\n'));
  }

  sleep() {
    game.sleep();
    SFX.heal();
    this.log(`你睡了一觉（第 ${game.day} 天）。体力回满，恢复了一些生命，但更饿了。`);
    this.hud.refresh();
    game.save();
    if (!game.alive) this.toGameOver();
  }

  descend() {
    SFX.descend();
    game.descend();
    game.save();
    if (game.won) { this.scene.start('GameOver'); return; }
    if (!game.alive) { this.toGameOver(); return; }
    this.scene.start('Field');
  }

  openCraft(station) { this.scene.pause(); this.scene.launch('Craft', { from: 'Base', station }); }
  openInventory() { this.scene.pause(); this.scene.launch('Inventory', { from: 'Base' }); }

  giveUp() {
    game.die();
    game.save();
    this.toGameOver();
  }

  toGameOver() { SFX.die(); this.scene.start('GameOver'); }
}
