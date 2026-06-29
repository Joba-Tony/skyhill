// ============================================================================
// ui.js — 主题 / 可复用 UI 组件（按钮、状态条、精灵、面板）/ 程序化音效
// ============================================================================

export const COLORS = {
  bg: 0x14141c,
  panel: 0x20202f,
  panelHi: 0x2c2c41,
  line: 0x3a3a52,
  accent: 0x4fd1c5,
  accentDim: 0x2c8079,
  hp: 0xe05a5a,
  stamina: 0x4fb0e0,
  hunger: 0xe0a83a,
  good: 0x6bd86b,
  bad: 0xe05a5a,
  gold: 0xf0c44f,
  text: '#e8e8f0',
  muted: '#9a9ab0',
  dark: '#14141c',
};

export const FONT = '"Courier New", ui-monospace, monospace';
export const TILES_KEY = 'tiles';

export function txt(scene, x, y, s, size = 16, color = COLORS.text) {
  return scene.add.text(x, y, s, {
    fontFamily: FONT, fontSize: `${size}px`, color,
  }).setResolution(2);
}

// 从精灵表取一帧（最近邻放大保持像素感）；frame<0 返回 null
export function sprite(scene, x, y, frame, scale = 3) {
  if (frame == null || frame < 0) return null;
  const img = scene.add.image(x, y, TILES_KEY, frame);
  img.setScale(scale);
  return img;
}

// 圆角面板
export function panel(scene, x, y, w, h, opts = {}) {
  const g = scene.add.graphics();
  g.fillStyle(opts.fill ?? COLORS.panel, opts.alpha ?? 1);
  g.lineStyle(opts.lineWidth ?? 2, opts.line ?? COLORS.line, 1);
  g.fillRoundedRect(x, y, w, h, opts.radius ?? 10);
  g.strokeRoundedRect(x, y, w, h, opts.radius ?? 10);
  return g;
}

// ---------- 按钮 ----------
// 返回 Container，附带 .setEnabled(bool) / .setLabel(str)
export function button(scene, x, y, w, h, label, onClick, opts = {}) {
  const c = scene.add.container(x, y);
  const radius = opts.radius ?? 8;
  const baseFill = opts.fill ?? COLORS.panelHi;
  const hiFill = opts.hover ?? COLORS.accentDim;
  const g = scene.add.graphics();
  const t = txt(scene, 0, 0, label, opts.size ?? 16, opts.color ?? COLORS.text).setOrigin(0.5);
  let icon = null;
  if (opts.frame != null && opts.frame >= 0) {
    icon = sprite(scene, -w / 2 + 20, 0, opts.frame, opts.iconScale ?? 2);
  }
  c.add([g, t]);
  if (icon) { c.add(icon); t.setX(12); }

  let enabled = true, hovered = false;
  const draw = () => {
    g.clear();
    const fill = !enabled ? COLORS.panel : (hovered ? hiFill : baseFill);
    g.fillStyle(fill, 1);
    g.lineStyle(2, !enabled ? COLORS.line : (hovered ? COLORS.accent : COLORS.line), 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
    t.setAlpha(enabled ? 1 : 0.4);
    if (icon) icon.setAlpha(enabled ? 1 : 0.4);
  };
  draw();

  c.setSize(w, h);
  c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  c.on('pointerover', () => { hovered = true; draw(); if (enabled) scene.input.manager.canvas.style.cursor = 'pointer'; });
  c.on('pointerout', () => { hovered = false; draw(); scene.input.manager.canvas.style.cursor = 'default'; });
  c.on('pointerdown', () => { if (enabled) { SFX.click(); scene.tweens.add({ targets: c, scaleX: 0.96, scaleY: 0.96, duration: 60, yoyo: true }); } });
  c.on('pointerup', () => { if (enabled && onClick) onClick(); });

  c.setEnabled = (v) => { enabled = v; draw(); return c; };
  c.setLabel = (s) => { t.setText(s); return c; };
  c.isEnabled = () => enabled;
  return c;
}

// ---------- 状态条 ----------
// 返回 {container, set(value,max)}; 带图标、标签、数值
export function statBar(scene, x, y, w, label, color, opts = {}) {
  const h = opts.h ?? 16;
  const c = scene.add.container(x, y);
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.35); bg.fillRoundedRect(0, 0, w, h, 5);
  const fill = scene.add.graphics();
  const lbl = txt(scene, 0, -16, label, 12, COLORS.muted);
  const val = txt(scene, w, -16, '', 12, COLORS.muted).setOrigin(1, 0);
  c.add([bg, fill, lbl, val]);
  const set = (value, max) => {
    const pct = max > 0 ? Phaser.Math.Clamp(value / max, 0, 1) : 0;
    fill.clear();
    fill.fillStyle(color, 1);
    if (pct > 0) fill.fillRoundedRect(2, 2, Math.max(4, (w - 4) * pct), h - 4, 4);
    val.setText(`${Math.round(value)}/${max}`);
  };
  return { container: c, set, label: lbl, valueText: val };
}

// ---------- 程序化音效（WebAudio，无需素材）----------
export const SFX = {
  ctx: null, muted: false,
  _ctx() {
    if (this.muted) return null;
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  _beep(freq, dur, type = 'square', vol = 0.06) {
    const ctx = this._ctx(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now); o.stop(now + dur);
  },
  click() { this._beep(420, 0.06, 'square', 0.04); },
  hit()   { this._beep(180, 0.10, 'sawtooth', 0.07); },
  hurt()  { this._beep(110, 0.16, 'square', 0.07); },
  heal()  { this._beep(660, 0.12, 'sine', 0.06); setTimeout(() => this._beep(880, 0.12, 'sine', 0.05), 90); },
  loot()  { this._beep(740, 0.08, 'triangle', 0.05); setTimeout(() => this._beep(990, 0.09, 'triangle', 0.05), 80); },
  die()   { this._beep(220, 0.3, 'sawtooth', 0.08); setTimeout(() => this._beep(140, 0.4, 'sawtooth', 0.08), 150); },
  win()   { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._beep(f, 0.18, 'triangle', 0.06), i * 130)); },
  descend(){ this._beep(330, 0.10, 'sine', 0.05); },
};

// 颜色数值 → CSS 字符串
export function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }
