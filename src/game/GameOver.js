// GameOver — 结算页
import { txt, neonButton, hex } from './ui.js';
import { PAL } from './data.js';

export class GameOver extends Phaser.Scene {
  constructor() { super('GameOver'); }
  init(data) { this.result = data; }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor(0x0a0612);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    txt(this, W / 2, H * 0.24, '你 被 吞 没 了', 52, hex(PAL.hp)).setOrigin(0.5).setShadow(0, 0, hex(PAL.hp), 20);

    const fmt = s => { const m = Math.floor(s / 60), ss = Math.floor(s % 60); return `${m}:${ss.toString().padStart(2, '0')}`; };
    const best = +(localStorage.getItem('mw_best') || 0);
    const stats = [
      `存活时间    ${fmt(this.result.time)}`,
      `击杀数      ${this.result.kills}`,
      `达到等级    Lv ${this.result.level}`,
      `最佳记录    ${fmt(best)}`,
    ];
    stats.forEach((s, i) => txt(this, W / 2, H * 0.42 + i * 34, s, 20, '#d8e0ff').setOrigin(0.5));

    if (this.result.time >= best - 0.5 && best > 0) txt(this, W / 2, H * 0.42 + 4 * 34 + 10, '★ 新纪录！', 20, hex(PAL.gem)).setOrigin(0.5);

    neonButton(this, W / 2 - 130, H * 0.82, 230, 56, '↻ 再来一局', () => this.scene.start('Game'), { color: PAL.player, size: 20 });
    neonButton(this, W / 2 + 130, H * 0.82, 230, 56, '主菜单', () => this.scene.start('Menu'), { color: PAL.gem, size: 20 });
  }
}
