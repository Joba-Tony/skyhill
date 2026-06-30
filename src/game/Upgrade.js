// Upgrade — 升级三选一覆盖层（霓虹卡片，支持点击或按 1/2/3）
import { txt, hex } from './ui.js';
import { PAL } from './data.js';

export class Upgrade extends Phaser.Scene {
  constructor() { super('Upgrade'); }
  init(data) { this.gs = data.gs; this.choices = data.choices; }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x05060c, 0.78).setInteractive();
    txt(this, W / 2, H * 0.2, '⬆  升 级 !', 40, hex(PAL.gem)).setOrigin(0.5).setShadow(0, 0, hex(PAL.gem), 16);
    txt(this, W / 2, H * 0.2 + 48, '选择一项强化', 16, '#9aa3c0').setOrigin(0.5);

    const n = this.choices.length;
    const cw = 250, gap = 28, total = n * cw + (n - 1) * gap;
    let x = W / 2 - total / 2 + cw / 2;
    this.choices.forEach((c, i) => { this.card(c, x, H * 0.55, cw, 230, i); x += cw + gap; });

    this.input.keyboard.once('keydown-ONE', () => this.pick(0));
    this.input.keyboard.once('keydown-TWO', () => this.pick(1));
    this.input.keyboard.once('keydown-THREE', () => this.pick(2));
  }

  card(c, x, y, w, h, idx) {
    const color = c.color || PAL.player;
    const cont = this.add.container(x, y);
    const glow = this.add.image(0, 0, 'glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(w * 1.2, h * 1.1).setAlpha(0.12);
    const g = this.add.graphics();
    const draw = (hi) => { g.clear(); g.fillStyle(0x0c1020, 0.96); g.lineStyle(hi ? 4 : 2, color, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 14); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14); };
    draw(false);
    const tag = ({ wnew: '新武器', wup: '武器强化', passive: '被动', heal: '补给' })[c.kind] || '';
    const tg = txt(this, 0, -h / 2 + 22, tag, 13, hex(color)).setOrigin(0.5);
    const title = txt(this, 0, -28, c.title, 20, '#ffffff').setOrigin(0.5).setWordWrapWidth(w - 28).setAlign('center');
    const desc = txt(this, 0, 34, c.desc, 15, '#aab2d0').setOrigin(0.5).setWordWrapWidth(w - 30).setAlign('center');
    const key = txt(this, 0, h / 2 - 24, `[${idx + 1}]`, 14, hex(color)).setOrigin(0.5);
    cont.add([glow, g, tg, title, desc, key]);
    cont.setSize(w, h).setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    cont.on('pointerover', () => { draw(true); glow.setAlpha(0.3); this.tweens.add({ targets: cont, scale: 1.04, duration: 100 }); });
    cont.on('pointerout', () => { draw(false); glow.setAlpha(0.12); this.tweens.add({ targets: cont, scale: 1, duration: 100 }); });
    cont.on('pointerup', () => this.pick(idx));
  }

  pick(i) {
    const c = this.choices[i];
    if (!c) return;
    this.gs.applyUpgrade(c);
    this.scene.stop();
    this.scene.resume('Game');
  }
}
