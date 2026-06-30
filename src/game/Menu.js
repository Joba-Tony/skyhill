// Menu — 霓虹主菜单
import { PAL } from './data.js';
import { txt, neonButton, hex } from './ui.js';
import { Sfx } from './sfx.js';

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor(PAL.bg);

    // 漂浮的霓虹光点背景
    this.bgParticles();

    // 标题
    txt(this, W / 2, H * 0.26, '末 世 幸 存', 64, hex(PAL.player)).setOrigin(0.5).setShadow(0, 0, hex(PAL.player), 24);
    txt(this, W / 2, H * 0.26 + 58, 'WASTELAND  SURVIVORS', 18, hex(PAL.gem)).setOrigin(0.5);
    txt(this, W / 2, H * 0.26 + 92, '在无尽的变异怪潮中活下去 · 升级 · 变强', 15, '#8a93b0').setOrigin(0.5);

    // 最高记录
    const best = +(localStorage.getItem('mw_best') || 0);
    if (best > 0) txt(this, W / 2, H * 0.45, `最长存活：${this.fmt(best)}`, 16, '#c0c8e0').setOrigin(0.5);

    neonButton(this, W / 2, H * 0.6, 300, 64, '▶  开始游戏', () => this.scene.start('Game'), { color: PAL.player, size: 24 });

    const muteBtn = neonButton(this, W / 2, H * 0.6 + 84, 200, 46,
      Sfx.muted ? '🔇 已静音' : '🔊 音效开', () => muteBtn.setLabel(Sfx.toggle() ? '🔇 已静音' : '🔊 音效开'),
      { color: PAL.gem, size: 16 });

    txt(this, W / 2, H - 70, 'WASD / 方向键 移动 · 武器自动攻击 · 升级三选一', 14, '#7a83a0').setOrigin(0.5);
    txt(this, W / 2, H - 30, '美术：纯代码程序化生成 · 音效：Kenney (CC0) · 引擎：Phaser 3', 12, '#5a6080').setOrigin(0.5);
  }

  bgParticles() {
    const W = this.scale.width, H = this.scale.height;
    const colors = [PAL.player, PAL.gem, PAL.bolt, 0xff5c8a];
    const e = this.add.particles(0, 0, 'glow', {
      x: { min: 0, max: W }, y: { min: 0, max: H },
      lifespan: 4000, speedY: { min: -14, max: -34 }, speedX: { min: -8, max: 8 },
      scale: { start: 0.18, end: 0 }, alpha: { start: 0.5, end: 0 },
      blendMode: 'ADD', frequency: 180, quantity: 1,
      tint: colors,
    });
    e.setDepth(-1);
  }

  fmt(s) { const m = Math.floor(s / 60), ss = Math.floor(s % 60); return `${m}:${ss.toString().padStart(2, '0')}`; }
}
