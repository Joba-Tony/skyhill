// ui.js — 霓虹风格 UI 组件
export const FONT = '"Trebuchet MS", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
export const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');

export function txt(scene, x, y, s, size = 16, color = '#e8f0ff') {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color }).setResolution(2);
}

// 霓虹按钮：发光描边 + 辉光 + 悬停变亮。返回 container（含 setEnabled）
export function neonButton(scene, x, y, w, h, label, onClick, opts = {}) {
  const color = opts.color ?? 0x53e0ff;
  const c = scene.add.container(x, y);
  const glow = scene.add.image(0, 0, 'glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.0);
  glow.setDisplaySize(w * 1.3, h * 2.2);
  const g = scene.add.graphics();
  const draw = (hi) => {
    g.clear();
    g.fillStyle(0x0b0f1c, hi ? 0.95 : 0.8);
    g.lineStyle(2, color, hi ? 1 : 0.7);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
  };
  draw(false);
  const t = txt(scene, 0, 0, label, opts.size ?? 20, hex(color)).setOrigin(0.5);
  c.add([glow, g, t]);
  c.setSize(w, h);
  let enabled = true;
  c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  c.on('pointerover', () => { if (!enabled) return; draw(true); glow.setAlpha(0.35); scene.input.manager.canvas.style.cursor = 'pointer'; });
  c.on('pointerout', () => { draw(false); glow.setAlpha(0); scene.input.manager.canvas.style.cursor = 'default'; });
  c.on('pointerdown', () => { if (enabled) scene.tweens.add({ targets: c, scaleX: 0.96, scaleY: 0.96, duration: 70, yoyo: true }); });
  c.on('pointerup', () => { if (enabled && onClick) onClick(); });
  c.setEnabled = (v) => { enabled = v; t.setAlpha(v ? 1 : 0.4); return c; };
  c.setLabel = (s) => { t.setText(s); return c; };
  return c;
}
