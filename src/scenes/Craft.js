// Craft — 合成覆盖层（工作台 / 炉灶）
import { COLORS, txt, button, sprite, panel, SFX, hex } from '../ui.js';
import { ITEMS } from '../data.js';
import { game } from '../state.js';

export class Craft extends Phaser.Scene {
  constructor() { super('Craft'); }
  init(data) { this.from = data.from || 'Base'; this.station = data.station || 'workbench'; }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.graphics(); bg.fillStyle(0x000000, 0.65); bg.fillRect(0, 0, W, H);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);

    panel(this, 80, 50, W - 160, H - 100, { fill: COLORS.panel });
    const name = this.station === 'workbench' ? '工作台' : '炉灶';
    txt(this, 110, 72, `${name} · 合成`, 22, COLORS.text);
    txt(this, 110, 104, `成功率受智力影响（当前智力 ${game.int}）。失败会损耗材料。`, 13, COLORS.muted);

    button(this, W - 150, 76, 130, 40, '关闭 ✕', () => this.close(), { size: 15 });

    this.listUI = this.add.container(0, 0);
    this.msg = txt(this, W / 2, H - 80, '', 15, COLORS.gold).setOrigin(0.5);
    this.render();
  }

  render() {
    this.listUI.removeAll(true);
    const recipes = game.recipesFor(this.station);
    const x0 = 110, y0 = 150, rowH = 86;
    if (recipes.length === 0) this.listUI.add(txt(this, x0, y0, '（暂无配方）', 15, COLORS.muted));

    recipes.forEach((r, i) => {
      const y = y0 + i * rowH;
      const out = ITEMS[r.out[0]];
      this.listUI.add(panel(this, x0, y, this.scale.width - 220, rowH - 12, { fill: COLORS.panelHi, radius: 8 }));
      const ic = sprite(this, x0 + 34, y + 36, out.frame, 2.6); if (ic) this.listUI.add(ic);
      this.listUI.add(txt(this, x0 + 64, y + 12, `${out.name} ×${r.out[1]}`, 17, hex(COLORS.gold)));
      this.listUI.add(txt(this, x0 + 64, y + 38, r.desc, 13, COLORS.muted));
      // 材料需求
      const costStr = r.cost.map(([id, n]) => `${ITEMS[id].name} ${game.countItem(id)}/${n}`).join('   ');
      const can = game.canCraft(r);
      this.listUI.add(txt(this, x0 + 64, y + 56, costStr, 13, can ? COLORS.text : COLORS.muted));

      const b = button(this, this.scale.width - 200, y + 36, 150, 44, '合 成', () => this.doCraft(r),
        { size: 16, fill: can ? COLORS.accentDim : COLORS.panel, hover: COLORS.accent });
      b.setEnabled(can);
      this.listUI.add(b);
    });
  }

  doCraft(r) {
    const res = game.craft(r);
    if (!res) return;
    if (res.ok) { SFX.loot(); this.flash(`✔ 合成成功：${ITEMS[r.out[0]].name}`); }
    else { SFX.craftFail(); this.flash('✘ 合成失败，材料损耗了……'); }
    game.save();
    this.render();
  }

  flash(s) {
    this.msg.setText(s).setAlpha(1);
    this.tweens.killTweensOf(this.msg);
    this.tweens.add({ targets: this.msg, alpha: 0, delay: 1400, duration: 600 });
  }

  close() { this.scene.stop(); this.scene.resume(this.from); }
}
