// Menu — 主菜单（标题 / 新游戏 / 继续 / 静音）
import { COLORS, txt, button, sprite, SFX, hex } from '../ui.js';
import { Sound } from '../audio.js';
import { GameState, game } from '../state.js';
import { FRAMES } from '../data.js';

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    // 首次交互后启动背景乐（浏览器需用户手势才能播放音频）
    this.input.once('pointerdown', () => Sound.startBgm());

    // 背景：摩天楼剪影 + 渐变天空
    this.drawSkyline(W, H);

    // 标题
    txt(this, W / 2, 92, '天 空 之 山', 56, COLORS.text).setOrigin(0.5).setShadow(0, 4, '#000', 6);
    txt(this, W / 2, 142, 'SKYHILL', 22, hex(COLORS.accent)).setOrigin(0.5).setLetterSpacing?.(8);
    txt(this, W / 2, 176, '末世生存 · 从 100 层逃生', 16, COLORS.muted).setOrigin(0.5);

    // 装饰精灵（角色 + 怪物）
    sprite(this, W / 2 - 120, 250, FRAMES.guard, 4);
    sprite(this, W / 2, 250, FRAMES.imp, 4);
    sprite(this, W / 2 + 120, 250, FRAMES.golem, 4);

    // 按钮
    const cx = W / 2;
    const hasSave = GameState.hasSave();
    button(this, cx, 360, 280, 54, '新 游 戏', () => this.scene.start('ClassSelect'),
      { fill: COLORS.accentDim, hover: COLORS.accent, size: 22 });

    const cont = button(this, cx, 426, 280, 50, hasSave ? '继续游戏' : '继续游戏（无存档）', () => {
      const g = GameState.load();
      if (g) { Object.assign(game, g); this.scene.start('Base'); }
    }, { size: 18 });
    cont.setEnabled(hasSave);

    // 静音按钮
    const muteBtn = button(this, cx, 488, 160, 40, SFX.muted ? '🔇 已静音' : '🔊 音效开', () => {
      SFX.muted = !SFX.muted;
      muteBtn.setLabel(SFX.muted ? '🔇 已静音' : '🔊 音效开');
    }, { size: 14 });

    txt(this, W / 2, H - 26, '美术：Kenney Tiny Dungeon (CC0) · 引擎：Phaser 3', 12, COLORS.muted).setOrigin(0.5);

    // 角色轻微浮动
    this.tweens.add({ targets: this.children.list.filter(o => o.type === 'Image'), y: '-=6', duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  drawSkyline(W, H) {
    const g = this.add.graphics();
    // 天空渐变（用多层矩形近似）
    for (let i = 0; i < 20; i++) {
      const t = i / 20;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x1a1530),
        Phaser.Display.Color.ValueToColor(0x3a2a4a), 20, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (H / 20) * i, W, H / 20 + 1);
    }
    // 楼宇剪影
    g.fillStyle(0x0d0d16, 0.9);
    let x = -20;
    const rnd = [80, 140, 110, 180, 95, 160, 130, 200, 90, 150, 120];
    let i = 0;
    while (x < W + 40) {
      const bw = 50 + (rnd[i % rnd.length] % 40);
      const bh = rnd[i % rnd.length] + 60;
      g.fillRect(x, H - bh, bw, bh);
      // 窗户
      g.fillStyle(0x2a2a40, 0.5);
      for (let wy = H - bh + 10; wy < H - 10; wy += 18) {
        for (let wx = x + 8; wx < x + bw - 8; wx += 16) g.fillRect(wx, wy, 7, 9);
      }
      g.fillStyle(0x0d0d16, 0.9);
      x += bw + 6; i++;
    }
  }
}
