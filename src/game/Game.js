// ============================================================================
// Game — 末世幸存者核心场景：怪潮 / 自动武器 / 经验升级 / 满屏 juice
// 采用手动距离碰撞（可控、性能好），纯程序化霓虹视觉。
// ============================================================================
import { PAL, ENEMIES, WEAPONS, PASSIVES, BALANCE, spawnTableFor, enemyScale, BOSS_EVERY_MIN } from './data.js';
import { txt, hex } from './ui.js';
import { Sfx } from './sfx.js';

const TAU = Math.PI * 2;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

export class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor(PAL.bg);

    // ---- 世界层（随相机移动）----
    this.grid = this.add.tileSprite(0, 0, W + 128, H + 128, 'grid').setOrigin(0).setScrollFactor(0).setDepth(-20);
    this.embers = this.add.particles(0, 0, 'glow', {
      x: { min: -W, max: W * 2 }, y: { min: -H, max: H * 2 },
      lifespan: 5000, speedY: { min: -10, max: -26 }, scale: { start: 0.12, end: 0 },
      alpha: { start: 0.3, end: 0 }, blendMode: 'ADD', frequency: 300, tint: [PAL.player, PAL.gem, 0xff5c8a],
    });
    this.embers.setDepth(-10);

    // ---- 状态 ----
    this.player = {
      x: 0, y: 0, r: BALANCE.playerR,
      hp: BALANCE.baseMaxHp, maxHp: BALANCE.baseMaxHp,
      moveSpeed: BALANCE.baseSpeed, magnet: BALANCE.baseMagnet,
      dmgMul: 1, fireMul: 1, regen: 0, armor: 0, xpMul: 1,
      iframe: 0,
    };
    this.level = 1; this.xp = 0; this.xpNext = BALANCE.xpFirst; this.pendingLevels = 0;
    this.kills = 0; this.elapsed = 0; this.spawnAcc = 0; this.regenAcc = 0;
    this.nextBossMin = BOSS_EVERY_MIN;
    this.weapons = { bolt: { level: 1, t: 0 } };
    this.passiveStacks = {};
    this.enemies = []; this.bullets = []; this.gems = []; this.blades = [];
    this.over = false;

    // ---- 玩家精灵（身体 + 辉光 + 朝向）----
    this.pGlow = this.add.image(0, 0, 'glow').setTint(PAL.playerGlow).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(68, 68).setDepth(4);
    this.pBody = this.add.image(0, 0, 'disc').setTint(PAL.player).setDisplaySize(34, 34).setDepth(5);
    this.cameras.main.startFollow(this.pBody, true, 0.12, 0.12);

    // ---- 粒子特效（爆发型，按需 emitParticleAt）----
    this.fxHit = this.add.particles(0, 0, 'spark', { lifespan: 280, speed: { min: 60, max: 200 }, scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', emitting: false }).setDepth(8);
    this.fxDeath = this.add.particles(0, 0, 'spark', { lifespan: 520, speed: { min: 80, max: 320 }, scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', emitting: false }).setDepth(8);

    // ---- 输入 ----
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D', p: 'P' });
    this.usePointer = false;
    this.input.on('pointerdown', () => { this.usePointer = true; });
    this.input.on('pointerup', () => { this.usePointer = false; });

    this.buildHUD();
    // 开局一波，立刻有事可打
    for (let i = 0; i < 6; i++) { const c = this.spawnRing(); this.addEnemy(['walker', 'walker', 'runner'][i % 3], c.x, c.y, 0.1); }
    this.events.on('resume', () => { if (this.pendingLevels > 0) this.doLevelUp(); });

    // 开局点亮
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.flash(PAL.player, 0.25);
  }

  // ---------------- HUD ----------------
  buildHUD() {
    const W = this.scale.width;
    // 经验条（顶部整条）
    this.xpBarBg = this.add.rectangle(0, 0, W, 8, 0x101830).setOrigin(0).setScrollFactor(0).setDepth(50);
    this.xpBar = this.add.rectangle(0, 0, 0, 8, PAL.gem).setOrigin(0).setScrollFactor(0).setDepth(51);
    this.lvText = txt(this, 12, 14, 'Lv 1', 18, hex(PAL.gem)).setScrollFactor(0).setDepth(51);
    // 生命条
    this.hpBarBg = this.add.rectangle(12, 42, 240, 18, 0x2a0e16).setOrigin(0).setScrollFactor(0).setDepth(50);
    this.hpBar = this.add.rectangle(14, 44, 236, 14, PAL.hp).setOrigin(0).setScrollFactor(0).setDepth(51);
    this.hpText = txt(this, 132, 43, '', 13, '#ffffff').setOrigin(0.5, 0).setScrollFactor(0).setDepth(52);
    // 计时 / 击杀
    this.timeText = txt(this, W / 2, 16, '0:00', 30, '#e8f0ff').setOrigin(0.5, 0).setScrollFactor(0).setDepth(51).setShadow(0, 0, '#000', 6);
    this.killText = txt(this, W - 12, 16, '☠ 0', 18, '#ff8aa0').setOrigin(1, 0).setScrollFactor(0).setDepth(51);
    // 暗角
    this.add.image(W / 2, this.scale.height / 2, 'vignette').setDisplaySize(W * 1.2, this.scale.height * 1.2).setScrollFactor(0).setDepth(40);
  }

  refreshHUD() {
    const W = this.scale.width;
    this.xpBar.width = W * Phaser.Math.Clamp(this.xp / this.xpNext, 0, 1);
    this.lvText.setText('Lv ' + this.level);
    this.hpBar.width = 236 * Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1);
    this.hpText.setText(`${Math.max(0, Math.ceil(this.player.hp))} / ${this.player.maxHp}`);
    this.timeText.setText(this.fmt(this.elapsed));
    this.killText.setText('☠ ' + this.kills);
  }

  // ---------------- 主循环 ----------------
  update(time, delta) {
    if (this.over) return;
    const dt = Math.min(delta, 50) / 1000;
    this.elapsed += dt;
    const mins = this.elapsed / 60;

    this.movePlayer(dt);
    this.grid.tilePositionX = this.cameras.main.scrollX;
    this.grid.tilePositionY = this.cameras.main.scrollY;
    this.pGlow.setPosition(this.pBody.x, this.pBody.y);

    // 生成
    this.spawnAcc -= delta;
    const spawnCd = Math.max(BALANCE.spawnMin, BALANCE.spawnBaseCd - mins * 110);
    if (this.spawnAcc <= 0 && this.enemies.length < BALANCE.maxEnemies) { this.spawnWave(mins); this.spawnAcc = spawnCd; }
    if (mins >= this.nextBossMin) { this.spawnBoss(mins); this.nextBossMin += BOSS_EVERY_MIN; }

    // 武器
    this.fireWeapons(delta);
    this.updateBlades(dt);

    // 实体
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateGems(dt);

    // 回血 / 无敌帧
    if (this.player.regen > 0) { this.regenAcc += dt; if (this.regenAcc >= 1) { this.regenAcc -= 1; this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.regen); } }
    if (this.player.iframe > 0) this.player.iframe -= delta;
    this.pBody.setAlpha(this.player.iframe > 0 ? 0.45 + 0.3 * Math.sin(time * 0.05) : 1);

    this.refreshHUD();
  }

  movePlayer(dt) {
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.keys.a.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys.d.isDown) dx += 1;
    if (this.cursors.up.isDown || this.keys.w.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.keys.s.isDown) dy += 1;
    if (dx === 0 && dy === 0 && this.usePointer) {
      const p = this.input.activePointer;
      const wx = p.worldX, wy = p.worldY;
      const a = Math.atan2(wy - this.pBody.y, wx - this.pBody.x);
      if (dist2(wx, wy, this.pBody.x, this.pBody.y) > 400) { dx = Math.cos(a); dy = Math.sin(a); }
    }
    const len = Math.hypot(dx, dy) || 1;
    this.pBody.x += (dx / len) * this.player.moveSpeed * dt;
    this.pBody.y += (dy / len) * this.player.moveSpeed * dt;
    this.player.x = this.pBody.x; this.player.y = this.pBody.y;
  }

  // ---------------- 生成 ----------------
  spawnRing() {
    const cam = this.cameras.main;
    const margin = 80;
    const radius = Math.hypot(cam.width, cam.height) / 2 + margin;
    const a = Math.random() * TAU;
    return { x: this.player.x + Math.cos(a) * radius, y: this.player.y + Math.sin(a) * radius };
  }

  spawnWave(mins) {
    const table = spawnTableFor(mins);
    const waves = 1 + Math.floor(mins * 1.2);   // 随时间每波刷更多
    for (let w = 0; w < waves; w++) {
      if (this.enemies.length >= BALANCE.maxEnemies) break;
      const id = table[Math.floor(Math.random() * table.length)];
      const c = this.spawnRing();
      if (id === 'swarm') {
        for (let i = 0; i < 6; i++) this.addEnemy('swarm', c.x + Phaser.Math.Between(-44, 44), c.y + Phaser.Math.Between(-44, 44), mins);
      } else {
        this.addEnemy(id, c.x, c.y, mins);
      }
    }
  }

  spawnBoss(mins) {
    const c = this.spawnRing();
    const e = this.addEnemy('boss', c.x, c.y, mins);
    this.flash(0xff3b3b, 0.3);
    this.cameras.main.shake(300, 0.006);
    this.toast('⚠ 变异领主来袭', PAL.hp);
    this.bossRef = e;
  }

  addEnemy(id, x, y, mins) {
    const base = ENEMIES[id], sc = enemyScale(mins);
    // 辉光开销大，只给大体型（重装/Boss）加，避免大量小怪造成过度绘制
    let glow = null;
    if (base.boss || base.r >= 22) glow = this.add.image(x, y, 'glow').setTint(base.color).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(base.r * 3.6, base.r * 3.6).setAlpha(base.boss ? 0.6 : 0.4).setDepth(2);
    const spr = this.add.image(x, y, 'disc').setTint(base.color).setDisplaySize(base.r * 2, base.r * 2).setDepth(3);
    spr.setScale(0).setData('born', true);
    this.tweens.add({ targets: spr, scaleX: (base.r * 2) / 72, scaleY: (base.r * 2) / 72, duration: 200, ease: 'Back.out' });
    const e = {
      spr, glow, id, r: base.r, color: base.color, boss: !!base.boss,
      hp: base.hp * (base.boss ? 1 : sc.hp), maxHp: base.hp * (base.boss ? 1 : sc.hp),
      speed: base.speed * sc.speed, dmg: base.dmg * sc.dmg, xp: base.xp,
      hitCd: {}, // 环刃命中冷却（按刃 id）
    };
    if (base.boss) { e.hp = base.hp * (1 + mins * 0.25); e.maxHp = e.hp; this.makeBossBar(); }
    this.enemies.push(e);
    return e;
  }

  updateEnemies(dt) {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dx = p.x - e.spr.x, dy = p.y - e.spr.y;
      const d = Math.hypot(dx, dy) || 1;
      e.spr.x += (dx / d) * e.speed * dt;
      e.spr.y += (dy / d) * e.speed * dt;
      if (e.glow) e.glow.setPosition(e.spr.x, e.spr.y);
      // 接触玩家
      if (d < e.r + p.r && p.iframe <= 0) this.hurtPlayer(e.dmg, e);
      // 死亡
      if (e.hp <= 0) { this.killEnemy(e, i); }
    }
    if (this.bossRef && this.bossBar) {
      if (this.bossRef.hp <= 0) { this.bossBarBg.destroy(); this.bossBar.destroy(); this.bossBarTxt.destroy(); this.bossBar = null; this.bossRef = null; }
      else { this.bossBar.width = 420 * Phaser.Math.Clamp(this.bossRef.hp / this.bossRef.maxHp, 0, 1); }
    }
  }

  killEnemy(e, i) {
    this.fxDeath.setParticleTint(e.color);
    this.fxDeath.emitParticleAt(e.spr.x, e.spr.y, e.boss ? 60 : 14);
    if (e.boss) { this.cameras.main.shake(400, 0.012); this.flash(0xffffff, 0.4); this.hitStop(90); }
    this.spawnGem(e.spr.x, e.spr.y, e.xp, e.boss);
    if (e.glow) e.glow.destroy();
    e.spr.destroy();
    this.enemies.splice(i, 1);
    this.kills++;
    Sfx.play('hit', 0.25, 40);
  }

  // ---------------- 武器 ----------------
  fireWeapons(delta) {
    for (const id in this.weapons) {
      if (id === 'orbit') continue; // 持续型
      const w = this.weapons[id];
      w.t -= delta;
      if (w.t <= 0) {
        const s = WEAPONS[id].stat(w.level);
        if (id === 'bolt') this.fireBolt(s);
        else if (id === 'spread') this.fireSpread(s);
        else if (id === 'nova') this.fireNova(s);
        w.t = (s.cd || 1000) * this.player.fireMul;
      }
    }
  }

  fireBolt(s) {
    const target = this.nearestEnemy(this.player.x, this.player.y, 360);
    if (!target) return;
    const baseA = Math.atan2(target.spr.y - this.player.y, target.spr.x - this.player.x);
    const n = s.count;
    for (let k = 0; k < n; k++) {
      const a = baseA + (k - (n - 1) / 2) * 0.12;
      this.spawnBullet(a, s, PAL.bolt);
    }
    this.muzzle(baseA);
    Sfx.play('shoot', 0.12, 90);
  }

  fireSpread(s) {
    const target = this.nearestEnemy(this.player.x, this.player.y, 360);
    const baseA = target ? Math.atan2(target.spr.y - this.player.y, target.spr.x - this.player.x) : Math.random() * TAU;
    const arc = Phaser.Math.DegToRad(s.arc);
    for (let k = 0; k < s.count; k++) {
      const a = baseA - arc / 2 + (arc / (s.count - 1 || 1)) * k;
      this.spawnBullet(a, s, PAL.spread);
    }
    this.muzzle(baseA);
    Sfx.play('shoot', 0.12, 120);
  }

  spawnBullet(angle, s, color) {
    const spr = this.add.image(this.player.x, this.player.y, 'disc').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(s.r * 3.4, s.r * 3.4).setDepth(6);
    this.bullets.push({ spr, vx: Math.cos(angle) * s.speed, vy: Math.sin(angle) * s.speed, dmg: s.dmg * this.player.dmgMul, pierce: s.pierce || 0, r: s.r, life: 1.6, color });
  }

  fireNova(s) {
    const ring = this.add.image(this.player.x, this.player.y, 'ring').setTint(PAL.nova).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(20, 20).setDepth(6);
    this.tweens.add({ targets: ring, displayWidth: s.radius * 2, displayHeight: s.radius * 2, alpha: { from: 0.9, to: 0 }, duration: 420, ease: 'Cubic.out', onComplete: () => ring.destroy() });
    const dmg = s.dmg * this.player.dmgMul, r2 = s.radius * s.radius;
    for (const e of this.enemies) {
      if (dist2(e.spr.x, e.spr.y, this.player.x, this.player.y) <= r2) { e.hp -= dmg; this.fxHit.setParticleTint(e.color); this.fxHit.emitParticleAt(e.spr.x, e.spr.y, 4); }
    }
    this.cameras.main.shake(120, 0.004);
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.spr.x += b.vx * dt; b.spr.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0;
      if (!dead) {
        for (const e of this.enemies) {
          if (dist2(b.spr.x, b.spr.y, e.spr.x, e.spr.y) < (b.r + e.r) * (b.r + e.r)) {
            e.hp -= b.dmg;
            this.fxHit.setParticleTint(b.color); this.fxHit.emitParticleAt(b.spr.x, b.spr.y, 5);
            this.tweens.add({ targets: e.spr, scaleX: e.spr.scaleX * 1.18, scaleY: e.spr.scaleY * 1.18, duration: 60, yoyo: true });
            if (b.pierce > 0) b.pierce--; else { dead = true; break; }
          }
        }
      }
      if (dead) { b.spr.destroy(); this.bullets.splice(i, 1); }
    }
  }

  // 环刃（持续旋转）
  updateBlades(dt) {
    const w = this.weapons.orbit;
    if (!w) { for (const b of this.blades) b.spr.destroy(); this.blades.length = 0; return; }
    const s = WEAPONS.orbit.stat(w.level);
    // 调整刃数量
    while (this.blades.length < s.blades) {
      const spr = this.add.image(0, 0, 'blade').setTint(PAL.orbit).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(46, 20).setDepth(6);
      this.blades.push({ spr, hitCd: new Map() });
    }
    while (this.blades.length > s.blades) this.blades.pop().spr.destroy();
    w.ang = (w.ang || 0) + s.rot * dt;
    const dmg = s.dmg * this.player.dmgMul;
    for (let k = 0; k < this.blades.length; k++) {
      const bl = this.blades[k];
      const a = w.ang + (k / this.blades.length) * TAU;
      bl.spr.x = this.player.x + Math.cos(a) * s.radius;
      bl.spr.y = this.player.y + Math.sin(a) * s.radius;
      bl.spr.rotation = a;
      for (const e of this.enemies) {
        const cd = bl.hitCd.get(e) || 0;
        if (cd <= 0 && dist2(bl.spr.x, bl.spr.y, e.spr.x, e.spr.y) < (s.r + e.r) * (s.r + e.r)) {
          e.hp -= dmg; bl.hitCd.set(e, 0.35);
          this.fxHit.setParticleTint(PAL.orbit); this.fxHit.emitParticleAt(e.spr.x, e.spr.y, 4);
        }
      }
      for (const [e, t] of bl.hitCd) { const nt = t - dt; if (nt <= 0) bl.hitCd.delete(e); else bl.hitCd.set(e, nt); }
    }
  }

  nearestEnemy(x, y, maxD) {
    let best = null, bd = maxD * maxD;
    for (const e of this.enemies) { const d = dist2(x, y, e.spr.x, e.spr.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  // ---------------- 经验球 ----------------
  spawnGem(x, y, xp, big) {
    const spr = this.add.image(x, y, 'gem').setTint(PAL.gem).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(big ? 34 : 18, big ? 34 : 18).setDepth(2);
    this.tweens.add({ targets: spr, angle: 360, duration: 2200, repeat: -1 });
    this.gems.push({ spr, xp: xp * this.player.xpMul, r: big ? 16 : 9 });
  }

  updateGems(dt) {
    const p = this.player, mag2 = p.magnet * p.magnet;
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      const dx = p.x - g.spr.x, dy = p.y - g.spr.y, d2 = dx * dx + dy * dy;
      if (d2 < mag2) { const d = Math.sqrt(d2) || 1; const pull = Phaser.Math.Clamp(420 - d, 120, 420); g.spr.x += (dx / d) * pull * dt * 1.6; g.spr.y += (dy / d) * pull * dt * 1.6; }
      if (d2 < (p.r + g.r) * (p.r + g.r)) { this.collectGem(g, i); }
    }
  }

  collectGem(g, i) {
    this.xp += g.xp;
    this.fxHit.setParticleTint(PAL.gem); this.fxHit.emitParticleAt(g.spr.x, g.spr.y, 3);
    g.spr.destroy(); this.gems.splice(i, 1);
    Sfx.play('pickup', 0.2, 30);
    while (this.xp >= this.xpNext) { this.xp -= this.xpNext; this.level++; this.xpNext = Math.round(this.xpNext * BALANCE.xpGrow); this.pendingLevels++; }
    if (this.pendingLevels > 0 && !this.scene.isPaused()) this.doLevelUp();
  }

  // ---------------- 升级 ----------------
  doLevelUp() {
    this.pendingLevels--;
    Sfx.play('levelup', 0.5);
    this.flash(PAL.gem, 0.35);
    this.cameras.main.zoomTo(1.06, 120, 'Linear', true);
    this.time.delayedCall(140, () => this.cameras.main.zoomTo(1, 160));
    this.scene.pause();
    this.scene.launch('Upgrade', { gs: this, choices: this.rollUpgrades() });
  }

  rollUpgrades() {
    const pool = [];
    // 已有武器升级
    for (const id in this.weapons) { const w = this.weapons[id], def = WEAPONS[id]; if (w.level < def.max) pool.push({ kind: 'wup', id, title: `${def.name} → Lv${w.level + 1}`, desc: def.desc, color: def.color }); }
    // 新武器（最多 5 把）
    if (Object.keys(this.weapons).length < 5) for (const id in WEAPONS) if (!this.weapons[id]) pool.push({ kind: 'wnew', id, title: `新武器：${WEAPONS[id].name}`, desc: WEAPONS[id].desc, color: WEAPONS[id].color });
    // 被动
    for (const id in PASSIVES) { const def = PASSIVES[id]; if ((this.passiveStacks[id] || 0) < def.cap) pool.push({ kind: 'passive', id, title: def.name, desc: def.desc, color: def.color }); }
    // 随机三选
    Phaser.Utils.Array.Shuffle(pool);
    const out = pool.slice(0, 3);
    if (out.length === 0) out.push({ kind: 'heal', title: '急救', desc: '回复 40 生命', color: PAL.hp });
    return out;
  }

  applyUpgrade(c) {
    if (c.kind === 'wnew') this.weapons[c.id] = { level: 1, t: 0 };
    else if (c.kind === 'wup') this.weapons[c.id].level++;
    else if (c.kind === 'passive') { PASSIVES[c.id].apply(this.player); this.passiveStacks[c.id] = (this.passiveStacks[c.id] || 0) + 1; }
    else if (c.kind === 'heal') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
  }

  // ---------------- 受伤 / 结束 ----------------
  hurtPlayer(dmg, e) {
    const real = Math.max(1, dmg - this.player.armor);
    this.player.hp -= real;
    this.player.iframe = BALANCE.contactIFrame;
    this.flash(PAL.hp, 0.35);
    this.cameras.main.shake(160, 0.009);
    this.hitStop(50);
    Sfx.play('hurt', 0.4, 120);
    // 击退怪
    const a = Math.atan2(e.spr.y - this.player.y, e.spr.x - this.player.x);
    e.spr.x += Math.cos(a) * 18; e.spr.y += Math.sin(a) * 18;
    if (this.player.hp <= 0) this.gameOver();
  }

  gameOver() {
    this.over = true;
    this.fxDeath.setParticleTint(PAL.player); this.fxDeath.emitParticleAt(this.player.x, this.player.y, 80);
    this.cameras.main.shake(500, 0.02);
    this.flash(0xffffff, 0.6);
    this.pBody.setVisible(false); this.pGlow.setVisible(false);
    const best = Math.max(this.elapsed, +(localStorage.getItem('mw_best') || 0));
    localStorage.setItem('mw_best', best);
    this.time.delayedCall(700, () => this.scene.start('GameOver', { time: this.elapsed, kills: this.kills, level: this.level }));
  }

  // ---------------- 特效小工具 ----------------
  flash(color, alpha) {
    const W = this.scale.width, H = this.scale.height;
    const r = this.add.rectangle(W / 2, H / 2, W, H, color, alpha).setScrollFactor(0).setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: r, alpha: 0, duration: 220, onComplete: () => r.destroy() });
  }
  hitStop(ms) {
    this.time.timeScale = 0.0001; this.tweens.timeScale = 0.0001;
    this.time.delayedCall(ms, () => { this.time.timeScale = 1; this.tweens.timeScale = 1; }, [], this);
    // 用真实计时恢复（delayedCall 也受 timeScale 影响，用 setTimeout 兜底）
    setTimeout(() => { this.time.timeScale = 1; this.tweens.timeScale = 1; }, ms);
  }
  muzzle(a) {
    this.fxHit.setParticleTint(PAL.bolt);
    this.fxHit.emitParticleAt(this.player.x + Math.cos(a) * 18, this.player.y + Math.sin(a) * 18, 3);
  }
  makeBossBar() {
    const W = this.scale.width;
    this.bossBarBg = this.add.rectangle(W / 2, 74, 424, 16, 0x300, 0.8).setScrollFactor(0).setDepth(50);
    this.bossBar = this.add.rectangle(W / 2 - 210, 74, 420, 12, 0xff3b3b).setOrigin(0, 0.5).setScrollFactor(0).setDepth(51);
    this.bossBarTxt = txt(this, W / 2, 64, '变异领主', 12, '#ffd0d0').setOrigin(0.5, 0).setScrollFactor(0).setDepth(52);
  }
  toast(msg, color) {
    const t = txt(this, this.scale.width / 2, 120, msg, 26, hex(color)).setOrigin(0.5).setScrollFactor(0).setDepth(55).setShadow(0, 0, '#000', 6);
    this.tweens.add({ targets: t, y: 100, alpha: 0, duration: 1600, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }
  fmt(s) { const m = Math.floor(s / 60), ss = Math.floor(s % 60); return `${m}:${ss.toString().padStart(2, '0')}`; }
}
