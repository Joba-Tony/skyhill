// Shop — 流浪商人覆盖层（以物易物：材料换装备/补给）
import { COLORS, txt, button, sprite, panel, SFX, hex } from '../ui.js';
import { ITEMS, TRADES, BALANCE } from '../data.js';
import { game } from '../state.js';

export class Shop extends Phaser.Scene {
  constructor() { super('Shop'); }
  init(data) { this.from = data.from || 'Explore'; }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.graphics(); bg.fillStyle(0x000000, 0.65); bg.fillRect(0, 0, W, H);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);

    panel(this, 80, 50, W - 160, H - 100, { fill: COLORS.panel });
    txt(this, 110, 72, '🛒 流浪商人', 22, COLORS.text);
    txt(this, 110, 104, '用材料换取装备与补给（以物易物，无失败）。', 13, COLORS.muted);
    button(this, W - 150, 76, 130, 40, '关闭 ✕', () => this.close(), { size: 15 });

    this.listUI = this.add.container(0, 0);
    this.msg = txt(this, W / 2, H - 76, '', 15, COLORS.gold).setOrigin(0.5);
    this.render();
  }

  render() {
    this.listUI.removeAll(true);
    const x0 = 110, y0 = 148, rowH = 64;
    TRADES.forEach((t, i) => {
      const y = y0 + i * rowH;
      const out = ITEMS[t.out[0]];
      this.listUI.add(panel(this, x0, y, this.scale.width - 220, rowH - 12, { fill: COLORS.panelHi, radius: 8 }));
      const ic = sprite(this, x0 + 32, y + 26, out.frame, 2.2); if (ic) this.listUI.add(ic);
      this.listUI.add(txt(this, x0 + 60, y + 8, `${out.name} ×${t.out[1]}`, 16, hex(COLORS.gold)));
      const costStr = t.cost.map(([id, n]) => `${ITEMS[id].name} ${game.countItem(id)}/${n}`).join('   ');
      const can = t.cost.every(([id, n]) => game.hasItem(id, n));
      this.listUI.add(txt(this, x0 + 60, y + 32, '需要 ' + costStr, 13, can ? COLORS.text : COLORS.muted));
      const b = button(this, this.scale.width - 200, y + 26, 150, 42, '兑 换', () => this.buy(t),
        { size: 16, fill: can ? COLORS.accentDim : COLORS.panel, hover: COLORS.accent });
      b.setEnabled(can);
      this.listUI.add(b);
    });
  }

  buy(t) {
    const can = t.cost.every(([id, n]) => game.hasItem(id, n));
    if (!can) return;
    const newStack = !game.inv.find(s => s.id === t.out[0]);
    if (newStack && game.inv.length >= BALANCE.invSlots) { this.flash('背包已满'); return; }
    for (const [id, n] of t.cost) game.removeItem(id, n);
    game.addItem(t.out[0], t.out[1]);
    SFX.loot();
    this.flash(`✔ 换得 ${ITEMS[t.out[0]].name}`);
    game.save();
    this.render();
  }

  flash(s) {
    this.msg.setText(s).setAlpha(1);
    this.tweens.killTweensOf(this.msg);
    this.tweens.add({ targets: this.msg, alpha: 0, delay: 1300, duration: 600 });
  }

  close() { this.scene.stop(); this.scene.resume(this.from); }
}
