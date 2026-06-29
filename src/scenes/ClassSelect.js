// ClassSelect — 选择职业开局
import { COLORS, txt, button, sprite, panel, hex } from '../ui.js';
import { CLASSES } from '../data.js';
import { game } from '../state.js';

export class ClassSelect extends Phaser.Scene {
  constructor() { super('ClassSelect'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    txt(this, W / 2, 44, '选择你的幸存者', 30, COLORS.text).setOrigin(0.5);
    txt(this, W / 2, 80, '生化战争爆发，你被困在 SkyHill 酒店顶层。向下逃生吧。', 14, COLORS.muted).setOrigin(0.5);

    const cardW = 270, gap = 24;
    const totalW = CLASSES.length * cardW + (CLASSES.length - 1) * gap;
    let x = (W - totalW) / 2;
    const y = 130;

    CLASSES.forEach((cls) => {
      this.makeCard(cls, x, y, cardW, 360);
      x += cardW + gap;
    });

    button(this, W / 2, H - 40, 160, 40, '← 返回', () => this.scene.start('Menu'), { size: 16 });
  }

  makeCard(cls, x, y, w, h) {
    const cx = x + w / 2;
    panel(this, x, y, w, h, { fill: COLORS.panel });
    sprite(this, cx, y + 70, cls.frame, 6);
    txt(this, cx, y + 130, cls.name, 26, hex(COLORS.accent)).setOrigin(0.5);

    // 属性
    const s = cls.stats;
    const lines = [
      `生命 ${s.maxHp}    体力 ${s.maxStamina}`,
      `力量 ${s.str}   命中 ${s.acc}`,
      `敏捷 ${s.dex}   智力 ${s.int}`,
    ];
    lines.forEach((l, i) => txt(this, cx, y + 168 + i * 22, l, 15, COLORS.text).setOrigin(0.5));

    // 描述（自动换行）
    txt(this, x + 18, y + 240, cls.desc, 13, COLORS.muted)
      .setWordWrapWidth(w - 36).setLineSpacing(4);

    button(this, cx, y + h - 34, w - 40, 44, '选 择', () => this.choose(cls),
      { fill: COLORS.accentDim, hover: COLORS.accent, size: 18 });
  }

  choose(cls) {
    game.reset();
    game.initClass(cls);
    game.save();
    this.scene.start('Base');
  }
}
