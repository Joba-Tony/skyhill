// Field — 2D 横版动作场景：走动 / 实时战斗 / 翻找物资 / 上下楼
// 角色与怪物用程序化动画（弹跳走路、突刺攻击、受击闪白、扬尘、死亡特效）。
import { COLORS, txt, sprite, panel, SFX, hex, TILES_KEY } from '../ui.js';
import {
  FRAMES, ITEMS, BALANCE, LOOT_TABLE, RARE_LOOT, BOSS_FLOORS,
  roomWeightsFor, monsterPoolFor, MONSTERS,
} from '../data.js';
import { game, RNG } from '../state.js';
import { scaleMonster, playerHitChance, monsterHitChance, playerDamage, monsterDamage } from '../combat.js';
import { makeHUD } from '../hud.js';

const GROUND = 478;       // 角色脚底 y
const HERO_SPEED = 210;   // px/s
const ATK_RANGE = 96;
const ATK_CD = 360;       // ms
const SCALE = 4;

export class Field extends Phaser.Scene {
  constructor() { super('Field'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor(0x14141c);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    this.events.off('resume'); // 防止 restart 累积监听
    this.drawRoomBg(W, H);
    this.hud = makeHUD(this, game);

    // 提示条
    this.hint = txt(this, W / 2, 110, '', 13, COLORS.muted).setOrigin(0.5);

    // 实体容器（保证 z 在背景之上、HUD 之下）
    this.world = this.add.container(0, 0);

    // 玩家
    this.facing = 1;
    this.hero = this.add.image(120, GROUND, TILES_KEY, game.frame).setOrigin(0.5, 1).setScale(SCALE);
    this.world.add(this.hero);
    this.heroShadow = this.addShadow(this.hero);

    this.monsters = [];
    this.loot = [];
    this.npc = null;
    this.t = 0; this.moving = false; this.atkCd = 0; this.busy = false;

    this.spawnFloor();

    // 门
    this.makeDoors();

    // 输入
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({ a: 'A', d: 'D', atk: 'J', atk2: 'SPACE', inter: 'E', inv: 'I', base: 'R' });
    this.keys.atk.on('down', () => this.heroAttack());
    this.keys.atk2.on('down', () => this.heroAttack());
    this.keys.inter.on('down', () => this.interact());
    this.keys.inv.on('down', () => this.openInventory());
    this.btnDir = 0;
    this.makeTouchControls(W, H);

    this.events.on('resume', () => { this.hud.refresh(); this.busy = false; if (game.pendingPerks > 0) this.openLevelUp(); });
    game.save();
    this.toast(`第 ${game.floor} 层`, COLORS.gold);
  }

  // ---------- 场景背景 ----------
  drawRoomBg(W, H) {
    // 后墙
    for (let y = 130; y < GROUND - 28; y += 48)
      for (let x = 0; x < W; x += 48) {
        const im = this.add.image(x + 24, y + 24, TILES_KEY, (x / 48 + y / 48) % 2 ? FRAMES.wall : FRAMES.wall2).setScale(3);
        im.setAlpha(0.5);
      }
    // 地板
    for (let x = 0; x < W + 48; x += 48) this.add.image(x, GROUND + 14, TILES_KEY, FRAMES.floor).setOrigin(0.5, 0).setScale(3);
    // 地面阴影线
    const g = this.add.graphics(); g.fillStyle(0x000000, 0.25); g.fillRect(0, GROUND + 8, W, 6);
  }

  addShadow(target) {
    const s = this.add.ellipse(target.x, GROUND + 6, 46, 14, 0x000000, 0.3);
    this.world.add(s); this.world.sendToBack(s);
    return s;
  }

  // ---------- 楼层生成 ----------
  spawnFloor() {
    const d = game.descended;
    // Boss 层
    const bossId = BOSS_FLOORS[d];
    if (bossId && !game.bossesDone.includes(d)) {
      this.addMonster(bossId, 720, true);
      this.toast(`⚠ 层主出现！`, COLORS.bad);
    } else {
      // 普通怪
      const w = roomWeightsFor(d);
      let n = 0;
      if (RNG.chance(Math.min(0.92, (w.monster) / 60 + d / 200))) n = RNG.int(1, d < 20 ? 2 : 3);
      const pool = monsterPoolFor(d);
      for (let i = 0; i < n; i++) this.addMonster(RNG.pick(pool), 420 + i * 150 + RNG.int(-30, 30), false);
      // 商人（偶发）
      if (RNG.chance(0.16)) this.addNpc('trader', 300);
    }
    // 地面物资
    const lootN = RNG.int(0, 2);
    for (let i = 0; i < lootN; i++) this.addGroundLoot(240 + i * 180 + RNG.int(-20, 40));
    // 偶发上锁宝箱（需铁管）
    if (RNG.chance(0.22)) this.addChest(560 + RNG.int(-40, 80));
  }

  addMonster(id, x, boss) {
    const m = scaleMonster(id, game.descended);
    const spr = this.add.image(x, GROUND, TILES_KEY, m.frame).setOrigin(0.5, 1).setScale(boss ? SCALE * 1.5 : SCALE);
    spr.setFlipX(true);
    this.world.add(spr);
    const shadow = this.addShadow(spr);
    const bar = this.add.graphics();
    const obj = { ...m, boss, spr, shadow, bar, x, hp: m.hp, maxHp: m.maxHp, atkCd: RNG.int(300, 900), t: RNG.float(0, 6), dead: false, speed: boss ? 70 : (90 + m.tier * 8) };
    this.monsters.push(obj);
    this.drawMonBar(obj);
    return obj;
  }

  addGroundLoot(x) {
    const e = RNG.weighted(LOOT_TABLE);
    const n = RNG.int(e.n[0], e.n[1]);
    const spr = this.add.image(x, GROUND - 6, TILES_KEY, ITEMS[e.id].frame).setOrigin(0.5, 1).setScale(2.6);
    this.world.add(spr);
    this.tweens.add({ targets: spr, y: spr.y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.loot.push({ id: e.id, n, x, spr, kind: 'item' });
  }

  addChest(x) {
    const spr = this.add.image(x, GROUND, TILES_KEY, FRAMES.chestClosed).setOrigin(0.5, 1).setScale(3.2);
    this.world.add(spr);
    this.loot.push({ x, spr, kind: 'chest', opened: false });
  }

  addNpc(type, x) {
    const spr = this.add.image(x, GROUND, TILES_KEY, FRAMES.vendor).setOrigin(0.5, 1).setScale(SCALE);
    this.world.add(spr);
    this.tweens.add({ targets: spr, y: GROUND - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    txt(this, x, GROUND - 78, '商人', 12, COLORS.gold).setOrigin(0.5);
    this.npc = { type, x, spr };
  }

  makeDoors() {
    const W = this.scale.width;
    // 右：下楼
    this.downDoor = this.add.image(W - 40, GROUND, TILES_KEY, FRAMES.stairs).setOrigin(0.5, 1).setScale(3.4);
    txt(this, W - 40, GROUND - 92, '下楼 ▼', 13, COLORS.accent).setOrigin(0.5);
    // 左：返回基地
    this.upDoor = this.add.image(36, GROUND, TILES_KEY, FRAMES.ladder).setOrigin(0.5, 1).setScale(3.4);
    txt(this, 40, GROUND - 92, '基地 ▲', 12, COLORS.muted).setOrigin(0.5);
  }

  // ---------- 触屏 / 点击控制 ----------
  makeTouchControls(W, H) {
    const mk = (x, y, w, h, label, onDown, onUp) => {
      const z = this.add.rectangle(x, y, w, h, 0xffffff, 0.05).setOrigin(0.5).setInteractive();
      z.setStrokeStyle(2, COLORS.line, 0.6);
      this.add.existing(z);
      const t = txt(this, x, y, label, 20, COLORS.text).setOrigin(0.5);
      z.on('pointerdown', () => { onDown && onDown(); });
      z.on('pointerup', () => { onUp && onUp(); });
      z.on('pointerout', () => { onUp && onUp(); });
      return z;
    };
    const y = H - 38;
    mk(48, y, 76, 56, '◀', () => this.btnDir = -1, () => { if (this.btnDir === -1) this.btnDir = 0; });
    mk(132, y, 76, 56, '▶', () => this.btnDir = 1, () => { if (this.btnDir === 1) this.btnDir = 0; });
    mk(W - 250, y, 96, 56, '⚔ 攻击', () => this.heroAttack());
    mk(W - 142, y, 96, 56, '✋ 交互', () => this.interact());
    mk(W - 44, y, 70, 56, '🎒', () => this.openInventory());
  }

  // ---------- 主循环 ----------
  update(time, delta) {
    if (this.busy || !game.alive) return;
    const dt = delta / 1000;
    this.t += dt;

    // 输入移动
    let dir = this.btnDir;
    if (this.cursors.left.isDown || this.keys.a.isDown) dir = -1;
    if (this.cursors.right.isDown || this.keys.d.isDown) dir = 1;
    this.moving = dir !== 0;
    if (dir !== 0) {
      this.facing = dir;
      this.hero.x = Phaser.Math.Clamp(this.hero.x + dir * HERO_SPEED * dt, 60, this.scale.width - 60);
      this.hero.setFlipX(dir < 0);
      if (Math.random() < 0.12) this.dust(this.hero.x - dir * 16);
    }
    this.animEntity(this.hero, this.moving, SCALE);
    this.heroShadow.x = this.hero.x;

    // 自动拾取地面物资 + 提示
    this.updateLoot();
    this.updateHint();

    // 怪物 AI
    for (const m of this.monsters) if (!m.dead) this.updateMonster(m, dt);

    if (this.atkCd > 0) this.atkCd -= delta;
  }

  animEntity(spr, moving, baseScale) {
    if (moving) {
      const hop = Math.abs(Math.sin(this.t * 14)) * 9;
      spr.y = GROUND - hop;
      spr.rotation = Math.sin(this.t * 14) * 0.05;
      spr.scaleX = (spr.flipX ? -1 : 1) * baseScale;
      spr.scaleY = baseScale;
    } else {
      spr.y = GROUND;
      spr.rotation = 0;
      spr.scaleY = baseScale * (1 + Math.sin(this.t * 3) * 0.03);
      spr.scaleX = (spr.flipX ? -1 : 1) * baseScale;
    }
  }

  updateMonster(m, dt) {
    const dist = this.hero.x - m.x;
    const adist = Math.abs(dist);
    m.t += dt;
    m.spr.setFlipX(dist > 0); // 朝向玩家（精灵默认朝左）
    let moving = false;
    if (adist < 300 && adist > 56) {
      m.x += Math.sign(dist) * m.speed * dt;
      moving = true;
    } else if (adist <= 56) {
      m.atkCd -= dt * 1000;
      if (m.atkCd <= 0) { this.monsterAttack(m); m.atkCd = RNG.int(1000, 1500); }
    }
    // 程序化动画
    const sc = m.boss ? SCALE * 1.5 : SCALE;
    if (moving) { m.spr.y = GROUND - Math.abs(Math.sin(m.t * 12)) * 7; }
    else { m.spr.y = GROUND - (Math.sin(m.t * 4) + 1) * 1.5; }
    m.spr.scaleY = sc; m.spr.scaleX = (m.spr.flipX ? -1 : 1) * sc;
    m.shadow.x = m.x; m.spr.x = m.x;
    this.drawMonBar(m);
  }

  drawMonBar(m) {
    m.bar.clear();
    const w = m.boss ? 80 : 48, x = m.x - w / 2, y = GROUND - (m.boss ? 104 : 76);
    m.bar.fillStyle(0x000000, 0.5); m.bar.fillRect(x - 1, y - 1, w + 2, 7);
    const pct = Phaser.Math.Clamp(m.hp / m.maxHp, 0, 1);
    m.bar.fillStyle(m.boss ? 0xf0c44f : COLORS.bad, 1); m.bar.fillRect(x, y, w * pct, 5);
  }

  // ---------- 战斗 ----------
  heroAttack() {
    if (this.busy || !game.alive || this.atkCd > 0) return;
    this.atkCd = ATK_CD;
    const exhausted = game.spendStamina(3);
    SFX.hit();
    // 突刺动画 + 挥砍弧
    this.tweens.add({ targets: this.hero, x: this.hero.x + this.facing * 16, duration: 90, yoyo: true });
    this.slash(this.hero.x + this.facing * 46, GROUND - 36);
    // 命中判定
    let hitAny = false;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const dx = m.x - this.hero.x;
      if (Math.abs(dx) < ATK_RANGE && (Math.sign(dx) === this.facing || Math.abs(dx) < 40)) {
        hitAny = true;
        if (RNG.chance(playerHitChance(game, m))) {
          const dmg = playerDamage(game, m);
          m.hp -= dmg;
          this.spark(m.x, GROUND - 40, 0xffffff);
          this.dmgText(m.x, GROUND - 70, dmg, '#ffffff');
          this.hurtFlash(m.spr);
          this.knockback(m, this.facing * 12);
          if (m.hp <= 0) this.killMonster(m);
        } else {
          this.dmgText(m.x, GROUND - 70, 'Miss', '#9a9ab0');
        }
      }
    }
    if (exhausted) this.toast('精疲力竭！', COLORS.bad);
    this.hud.refresh();
    if (!game.alive) this.toGameOver();
  }

  monsterAttack(m) {
    if (!game.alive) return;
    this.tweens.add({ targets: m.spr, x: m.x + Math.sign(this.hero.x - m.x) * 14, duration: 110, yoyo: true });
    if (RNG.chance(monsterHitChance(game, m))) {
      const dmg = monsterDamage(game, m, false);
      game.hp = Phaser.Math.Clamp(game.hp - dmg, 0, game.maxHp);
      SFX.hurt();
      this.spark(this.hero.x, GROUND - 40, 0xe05a5a);
      this.dmgText(this.hero.x, GROUND - 78, dmg, '#e05a5a');
      this.hurtFlash(this.hero);
      this.cameras.main.shake(120, 0.008);
      if (m.poison && RNG.chance(0.6)) { game.poison += RNG.int(2, 3); this.toast('☠ 中毒', COLORS.bad); }
      this.hud.refresh();
      if (game.hp <= 0) { game.die(); this.toGameOver(); }
    } else {
      this.dmgText(this.hero.x, GROUND - 78, '闪避', '#4fb0e0');
    }
    game.save();
  }

  killMonster(m) {
    m.dead = true;
    const ups = game.addXp(m.xp);
    game.kills += 1;
    SFX.loot();
    m.bar.destroy();
    this.poof(m.x, GROUND - 30);
    this.tweens.add({ targets: m.spr, alpha: 0, angle: 90, y: GROUND + 10, duration: 360, onComplete: () => { m.spr.destroy(); m.shadow.destroy(); } });
    this.dmgText(m.x, GROUND - 96, `+${m.xp} XP`, '#6bd86b');
    // Boss 掉落
    if (m.boss && !game.bossesDone.includes(game.descended)) {
      game.bossesDone.push(game.descended);
      const drops = [['medkit', 1], [RNG.pick(['sword', 'axe', 'greatsword', 'hammer']), 1], [RNG.pick(RARE_LOOT), 1]];
      for (const [id, n] of drops) this.spawnDrop(id, n, m.x + RNG.int(-30, 30));
      this.toast('👑 层主被击败！', COLORS.gold);
    } else if (RNG.chance(0.5)) {
      const e = RNG.weighted(LOOT_TABLE); this.spawnDrop(e.id, RNG.int(e.n[0], e.n[1]), m.x);
    }
    game.save();
    if (ups > 0) { this.toast(`升到 Lv${game.level}！`, COLORS.gold); if (game.pendingPerks > 0) this.time.delayedCall(300, () => this.openLevelUp()); }
    this.hud.refresh();
  }

  spawnDrop(id, n, x) {
    const spr = this.add.image(x, GROUND - 40, TILES_KEY, ITEMS[id].frame).setOrigin(0.5, 1).setScale(2.6);
    this.world.add(spr);
    this.tweens.add({ targets: spr, y: GROUND - 6, duration: 400, ease: 'Bounce.out', onComplete: () => {
      this.tweens.add({ targets: spr, y: spr.y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    } });
    this.loot.push({ id, n, x, spr, kind: 'item' });
  }

  // ---------- 物资 / 交互 ----------
  updateLoot() {
    for (const l of this.loot) {
      if (l.kind === 'item' && !l.taken && Math.abs(this.hero.x - l.x) < 46) {
        l.taken = true;
        const ok = game.addItem(l.id, l.n);
        if (ok) { SFX.loot(); this.dmgText(l.x, GROUND - 80, `+${ITEMS[l.id].name}${l.n > 1 ? '×' + l.n : ''}`, '#6bd86b'); this.equipIfBetter(l.id); }
        else { l.taken = false; }
        if (l.taken) { this.tweens.add({ targets: l.spr, y: l.spr.y - 30, alpha: 0, duration: 300, onComplete: () => l.spr.destroy() }); }
        this.hud.refresh(); game.save();
      }
    }
  }

  equipIfBetter(id) {
    const it = ITEMS[id];
    if (it && it.type === 'weapon') {
      const cur = ITEMS[game.weaponId];
      const avg = a => (a.dmg[0] + a.dmg[1]) / 2;
      if (avg(it) > avg(cur)) { game.equip(id); this.toast(`装备 ${it.name}`, COLORS.accent); }
    } else if (it && it.type === 'armor' && !game.armorId) { game.equip(id); }
  }

  interact() {
    if (this.busy) return;
    const hx = this.hero.x, W = this.scale.width;
    if (hx > W - 110) return this.descend();
    if (hx < 110) return this.scene.start('Base');
    if (this.npc && Math.abs(hx - this.npc.x) < 70) return this.openShop();
    // 撬箱
    for (const l of this.loot) {
      if (l.kind === 'chest' && !l.opened && Math.abs(hx - l.x) < 60) {
        if (game.hasItem('pipe') || game.weaponId === 'pipe') {
          l.opened = true; l.spr.setFrame(FRAMES.chestOpen); SFX.loot();
          for (let i = 0; i < RNG.int(2, 3); i++) this.spawnDrop(RNG.pick(RARE_LOOT), 1, l.x + RNG.int(-40, 40));
          this.toast('撬开了宝箱！', COLORS.gold);
        } else this.toast('需要铁管才能撬开', COLORS.muted);
        return;
      }
    }
  }

  updateHint() {
    const hx = this.hero.x, W = this.scale.width;
    let h = '← → / A D 移动    J / 空格 攻击    E 交互    I 背包';
    if (hx > W - 110) h = '按 E 下楼 ▼';
    else if (hx < 110) h = '按 E 返回基地 ▲';
    else if (this.npc && Math.abs(hx - this.npc.x) < 70) h = '按 E 与商人交易';
    else {
      for (const l of this.loot) if (l.kind === 'chest' && !l.opened && Math.abs(hx - l.x) < 60) h = '按 E 撬开宝箱（需铁管）';
    }
    this.hint.setText(h);
  }

  descend() {
    if (this.busy) return;
    this.busy = true;
    SFX.descend();
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      game.descend();
      if (game.won) { this.scene.start('GameOver'); return; }
      if (!game.alive) { this.toGameOver(); return; }
      this.scene.restart();
    });
  }

  // ---------- 覆盖层 ----------
  openInventory() { if (this.busy) return; this.busy = true; this.scene.pause(); this.scene.launch('Inventory', { from: 'Field' }); }
  openShop() { if (this.busy) return; this.busy = true; this.scene.pause(); this.scene.launch('Shop', { from: 'Field' }); }
  openLevelUp() { this.busy = true; this.scene.pause(); this.scene.launch('LevelUp', { from: 'Field' }); }

  toGameOver() { SFX.die(); this.scene.start('GameOver'); }

  // ---------- 视觉特效 ----------
  slash(x, y) {
    const g = this.add.graphics({ x, y });
    g.lineStyle(4, 0xffffff, 0.9);
    g.beginPath(); g.arc(0, 0, 30, -Math.PI / 3 * this.facing, Math.PI / 3 * this.facing, this.facing < 0); g.strokePath();
    g.setScale(this.facing, 1);
    this.tweens.add({ targets: g, alpha: 0, scaleX: this.facing * 1.6, scaleY: 1.6, duration: 180, onComplete: () => g.destroy() });
  }
  spark(x, y, color) {
    const c = this.add.circle(x, y, 6, color, 1);
    this.tweens.add({ targets: c, scale: 3, alpha: 0, duration: 220, onComplete: () => c.destroy() });
  }
  poof(x, y) {
    for (let i = 0; i < 6; i++) {
      const p = this.add.circle(x + RNG.int(-10, 10), y, RNG.int(3, 6), 0xcccccc, 0.8);
      this.tweens.add({ targets: p, x: p.x + RNG.int(-30, 30), y: p.y - RNG.int(10, 40), alpha: 0, duration: 400, onComplete: () => p.destroy() });
    }
  }
  dust(x) {
    const p = this.add.circle(x, GROUND, RNG.int(2, 4), 0x886644, 0.5);
    this.tweens.add({ targets: p, y: GROUND - 8, alpha: 0, duration: 300, onComplete: () => p.destroy() });
  }
  dmgText(x, y, val, color) {
    const t = txt(this, x, y, '' + val, 16, color).setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 600, onComplete: () => t.destroy() });
  }
  hurtFlash(spr) {
    spr.setTintFill(0xffffff);
    this.time.delayedCall(80, () => spr.clearTint());
  }
  knockback(m, dx) { m.x += dx; }
  toast(msg, color) {
    const t = txt(this, this.scale.width / 2, 150, msg, 22, hex(color || COLORS.text)).setOrigin(0.5).setShadow(0, 2, '#000', 4);
    this.tweens.add({ targets: t, y: 132, alpha: 0, duration: 1200, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }
}
