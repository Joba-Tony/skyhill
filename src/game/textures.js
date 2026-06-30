// ============================================================================
// textures.js — 运行时程序化生成霓虹贴图（零美术依赖）。全部用白色，靠 tint 上色。
// ============================================================================

export function makeTextures(scene) {
  const radial = (key, size, stops) => {
    const t = scene.textures.createCanvas(key, size, size);
    const ctx = t.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [pos, col] of stops) g.addColorStop(pos, col);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    t.refresh();
  };

  // 柔和光晕（用于辉光/粒子）
  radial('glow', 96, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
  // 实心带柔边的圆（实体身体 / 子弹）
  radial('disc', 72, [[0, 'rgba(255,255,255,1)'], [0.62, 'rgba(255,255,255,1)'], [0.82, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
  // 小火花
  radial('spark', 28, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]);

  // 光环（冲击波）
  {
    const size = 160, t = scene.textures.createCanvas('ring', size, size), ctx = t.getContext();
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.shadowColor = 'rgba(255,255,255,1)'; ctx.shadowBlur = 10;
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 12, 0, Math.PI * 2); ctx.stroke();
    t.refresh();
  }

  // 宝石（经验，菱形）
  {
    const s = 28, t = scene.textures.createCanvas('gem', s, s), ctx = t.getContext();
    ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.moveTo(s / 2, 2); ctx.lineTo(s - 3, s / 2); ctx.lineTo(s / 2, s - 2); ctx.lineTo(3, s / 2);
    ctx.closePath(); ctx.fill();
    t.refresh();
  }

  // 环刃（细长发光体）
  {
    const w = 40, h = 16, t = scene.textures.createCanvas('blade', w, h), ctx = t.getContext();
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    t.refresh();
  }

  // 暗角（覆盖全屏，中间透明边缘暗）
  {
    const s = 512, t = scene.textures.createCanvas('vignette', s, s), ctx = t.getContext();
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.28, s / 2, s / 2, s * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    t.refresh();
  }

  // 1x1 白点（用于网格线 TileSprite 备用）
  if (!scene.textures.exists('px')) {
    const t = scene.textures.createCanvas('px', 2, 2); const ctx = t.getContext();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 2, 2); t.refresh();
  }

  // 网格瓦片（用于无限滚动背景）
  {
    const s = 64, t = scene.textures.createCanvas('grid', s, s), ctx = t.getContext();
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(120,140,255,0.10)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s, 0); ctx.moveTo(0, 0); ctx.lineTo(0, s); ctx.stroke();
    t.refresh();
  }
}
