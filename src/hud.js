// ============================================================================
// hud.js — 顶部状态栏（楼层 / 天数 / HP / 体力 / 饥饿 / 武器），基地与探索共用
// ============================================================================
import { COLORS, txt, sprite, panel } from './ui.js';
import { ITEMS, BALANCE } from './data.js';

export function makeHUD(scene, game) {
  const W = scene.scale.width;
  const root = scene.add.container(0, 0);
  panel(scene, 6, 6, W - 12, 86, { fill: COLORS.panel });
  root.add(scene.add.graphics()); // keep z

  // 角色图标 + 名字
  const icon = sprite(scene, 40, 40, game.frame, 3);
  const name = txt(scene, 64, 18, game.className, 16, COLORS.text);
  const weaponIcon = sprite(scene, 30, 66, ITEMS[game.weaponId]?.frame ?? -1, 1.5);
  const weaponTxt = txt(scene, 44, 60, '', 12, COLORS.muted);

  // 楼层 / 天数
  const floorTxt = txt(scene, 200, 16, '', 24, COLORS.gold);
  const dayTxt = txt(scene, 200, 52, '', 14, COLORS.muted);

  // 状态条
  const barX = 430, barW = W - barX - 30, lblW = 40;
  function makeBar(y, label, color) {
    txt(scene, barX, y - 2, label, 13, COLORS.muted);
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.4); bg.fillRoundedRect(barX + lblW, y, barW - lblW, 14, 4);
    const fill = scene.add.graphics();
    const val = txt(scene, barX + barW - 6, y - 1, '', 12, COLORS.text).setOrigin(1, 0);
    return { fill, val, y, color };
  }
  const hpBar = makeBar(18, '生命', COLORS.hp);
  const stBar = makeBar(44, '体力', COLORS.stamina);
  const hgBar = makeBar(70, '饥饿', COLORS.hunger);

  function setBar(bar, value, max, invert = false) {
    const pct = max > 0 ? Phaser.Math.Clamp(value / max, 0, 1) : 0;
    bar.fill.clear();
    let color = bar.color;
    if (!invert && pct < 0.3) color = COLORS.bad;          // 低血变红警示
    if (invert && pct > 0.7) color = COLORS.bad;           // 饥饿过高变红
    bar.fill.fillStyle(color, 1);
    const w = (barW - lblW - 4) * pct;
    if (w > 0) bar.fill.fillRoundedRect(barX + lblW + 2, bar.y + 2, Math.max(3, w), 10, 3);
    bar.val.setText(`${Math.round(value)}/${max}`);
  }

  function refresh() {
    if (icon) icon.setFrame(game.frame);
    name.setText(game.className);
    const wf = ITEMS[game.weaponId]?.frame ?? -1;
    if (weaponIcon) { if (wf >= 0) { weaponIcon.setFrame(wf).setVisible(true); } else weaponIcon.setVisible(false); }
    weaponTxt.setText(`${ITEMS[game.weaponId]?.name || '徒手'}${game.armorId ? ' + ' + ITEMS[game.armorId].name : ''}`);
    floorTxt.setText(`${game.floor} 层`);
    dayTxt.setText(`第 ${game.day} 天 · 已下降 ${game.descended} 层`);
    setBar(hpBar, game.hp, game.maxHp);
    setBar(stBar, game.stamina, game.maxStamina);
    setBar(hgBar, game.hunger, 100, true);
  }
  refresh();

  return { root, refresh };
}
