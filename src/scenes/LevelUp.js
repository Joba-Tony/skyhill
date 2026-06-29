// LevelUp — 升级强化覆盖层（花光所有强化点后关闭）
import { COLORS, txt, button, panel, SFX, hex } from '../ui.js';
import { PERKS } from '../data.js';
import { game } from '../state.js';

export class LevelUp extends Phaser.Scene {
  constructor() { super('LevelUp'); }
  init(data) { this.from = data.from || 'Explore'; }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.graphics(); bg.fillStyle(0x000000, 0.7); bg.fillRect(0, 0, W, H);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    panel(this, W / 2 - 260, 110, 520, 380, { fill: COLORS.panel, line: COLORS.gold });
    this.title = txt(this, W / 2, 142, '', 26, hex(COLORS.gold)).setOrigin(0.5);
    txt(this, W / 2, 184, '选择一项永久强化', 15, COLORS.muted).setOrigin(0.5);
    this.listUI = this.add.container(0, 0);
    this.render();
  }

  render() {
    this.title.setText(`⭐ 升级！ Lv${game.level}（剩余 ${game.pendingPerks} 点）`);
    this.listUI.removeAll(true);
    let y = 226;
    PERKS.forEach(pk => {
      const b = button(this, this.scale.width / 2, y, 460, 46, `${pk.name}  —  ${pk.desc}`,
        () => this.pick(pk.id), { size: 15, fill: COLORS.panelHi, hover: COLORS.accentDim });
      this.listUI.add(b); y += 54;
    });
  }

  pick(id) {
    game.applyPerk(id);
    SFX.levelup();
    game.save();
    if (game.pendingPerks > 0) this.render();
    else this.close();
  }

  close() { this.scene.stop(); this.scene.resume(this.from); }
}
