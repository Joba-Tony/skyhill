// Inventory — 背包覆盖层（查看 / 使用 / 装备 / 丢弃）
import { COLORS, txt, button, sprite, panel, SFX, hex } from '../ui.js';
import { ITEMS, BALANCE } from '../data.js';
import { game } from '../state.js';

export function describeItem(id) {
  const it = ITEMS[id];
  if (it.type === 'weapon') return `武器 · 伤害 ${it.dmg[0]}-${it.dmg[1]}，命中 ${it.acc >= 0 ? '+' : ''}${it.acc}`;
  if (it.type === 'armor') return `护具 · 减伤 ${it.defense}`;
  if (it.type === 'consumable') {
    const p = [];
    if (it.heal) p.push(`生命 +${it.heal}`);
    if (it.stamina) p.push(`体力 +${it.stamina}`);
    if (it.hunger) p.push(`饥饿 ${it.hunger}`);
    return `消耗品 · ${p.join('，')}`;
  }
  return '合成材料';
}

export class Inventory extends Phaser.Scene {
  constructor() { super('Inventory'); }
  init(data) { this.from = data.from || 'Base'; }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.graphics(); bg.fillStyle(0x000000, 0.65); bg.fillRect(0, 0, W, H);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);

    panel(this, 40, 40, W - 80, H - 80, { fill: COLORS.panel });
    this.title = txt(this, 70, 60, '', 22, COLORS.text);
    txt(this, 70, 92, `装备：以下选中物品可使用 / 装备 / 丢弃`, 13, COLORS.muted);

    this.listUI = this.add.container(0, 0);
    this.detailUI = this.add.container(0, 0);
    this.selected = null;

    button(this, W - 110, 64, 120, 40, '关闭 ✕', () => this.close(), { size: 15 });
    this.render();
  }

  render() {
    this.title.setText(`背包  (${game.distinctCount}/${BALANCE.invSlots} 格)`);
    this.listUI.removeAll(true);
    this.detailUI.removeAll(true);

    // 列表（左）
    const x0 = 70, y0 = 130, rowH = 40;
    if (game.inv.length === 0) {
      this.listUI.add(txt(this, x0, y0, '（空空如也）', 15, COLORS.muted));
    }
    game.inv.forEach((s, i) => {
      const y = y0 + i * rowH;
      const it = ITEMS[s.id];
      const row = this.add.container(0, 0);
      const g = this.add.graphics();
      const sel = this.selected === s.id;
      g.fillStyle(sel ? COLORS.accentDim : COLORS.panelHi, 1);
      g.lineStyle(2, sel ? COLORS.accent : COLORS.line, 1);
      g.fillRoundedRect(x0, y, 360, rowH - 6, 6);
      g.strokeRoundedRect(x0, y, 360, rowH - 6, 6);
      row.add(g);
      const ic = sprite(this, x0 + 22, y + (rowH - 6) / 2, it.frame, 1.8); if (ic) row.add(ic);
      row.add(txt(this, x0 + 44, y + 8, `${it.name}`, 15, COLORS.text));
      row.add(txt(this, x0 + 350, y + 8, `×${s.n}`, 15, COLORS.muted).setOrigin(1, 0));
      const eq = (s.id === game.weaponId || s.id === game.armorId);
      g.setInteractive(new Phaser.Geom.Rectangle(x0, y, 360, rowH - 6), Phaser.Geom.Rectangle.Contains);
      g.on('pointerup', () => { this.selected = s.id; SFX.click(); this.render(); });
      this.listUI.add(row);
    });

    // 详情（右）
    const dx = 470, dw = this.scale.width - 40 - dx - 30;
    this.detailUI.add(panel(this, dx, 130, dw, 360, { fill: COLORS.panelHi }));
    this.detailUI.add(txt(this, dx + 16, 142, '装备中', 13, COLORS.muted));
    this.detailUI.add(txt(this, dx + 16, 162, `武器：${ITEMS[game.weaponId]?.name || '徒手'}`, 14, COLORS.text));
    this.detailUI.add(txt(this, dx + 16, 184, `护具：${game.armorId ? ITEMS[game.armorId].name : '无'}`, 14, COLORS.text));

    if (this.selected && game.hasItem(this.selected)) {
      const it = ITEMS[this.selected];
      sprite(this, dx + dw / 2, 270, it.frame, 5);
      this.detailUI.add(txt(this, dx + dw / 2, 320, it.name, 20, hex(COLORS.gold)).setOrigin(0.5));
      this.detailUI.add(txt(this, dx + 16, 350, describeItem(this.selected), 14, COLORS.text).setWordWrapWidth(dw - 32));

      let by = 420;
      const mk = (label, fn, opts) => { this.detailUI.add(button(this, dx + dw / 2, by, dw - 40, 40, label, fn, { size: 15, ...opts })); by += 48; };
      if (it.type === 'consumable') mk('使用', () => this.use(this.selected), { fill: COLORS.accentDim, hover: COLORS.accent });
      if (it.type === 'weapon' && this.selected !== game.weaponId) mk('装备', () => this.equip(this.selected), { fill: COLORS.accentDim, hover: COLORS.accent });
      if (it.type === 'armor' && this.selected !== game.armorId) mk('装备', () => this.equip(this.selected), { fill: COLORS.accentDim, hover: COLORS.accent });
      mk('丢弃 1 个', () => this.drop(this.selected));
    } else {
      this.detailUI.add(txt(this, dx + dw / 2, 300, '← 选择一个物品', 15, COLORS.muted).setOrigin(0.5));
    }
  }

  use(id) {
    const res = game.useItem(id);
    if (res) { SFX.heal(); }
    if (!game.hasItem(id)) this.selected = null;
    game.save(); this.render();
  }
  equip(id) { game.equip(id); SFX.click(); if (!game.hasItem(id)) this.selected = null; game.save(); this.render(); }
  drop(id) { game.removeItem(id, 1); if (!game.hasItem(id)) this.selected = null; game.save(); this.render(); }

  close() { this.scene.stop(); this.scene.resume(this.from); }
}
