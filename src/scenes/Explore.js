// Explore — 逐层探索：生成房间事件，处理搜刮 / 上锁房 / 特殊房 / 进入战斗
import { COLORS, txt, button, sprite, panel, SFX, hex } from '../ui.js';
import {
  FRAMES, ITEMS, BALANCE, LOOT_TABLE, RARE_LOOT,
  roomWeightsFor, monsterPoolFor, MONSTERS,
} from '../data.js';
import { game, RNG } from '../state.js';
import { makeHUD } from '../hud.js';

export class Explore extends Phaser.Scene {
  constructor() { super('Explore'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.hud = makeHUD(this, game);

    // 日志
    panel(this, 24, 110, 360, H - 170, { fill: COLORS.panel });
    txt(this, 40, 122, '日志', 14, COLORS.muted);
    this.logLines = [];
    this.logText = txt(this, 40, 148, '', 13, COLORS.text).setWordWrapWidth(330).setLineSpacing(5);

    this.roomUI = this.add.container(0, 0);
    this.actionUI = this.add.container(0, 0);

    // 生成 / 沿用本层房间
    if (game.roomFloor !== game.floor || !game.currentRoom) {
      game.currentRoom = this.genRoom();
      game.roomFloor = game.floor;
      this.log(`你撬开门，进入第 ${game.floor} 层……`);
      this.maybeAutoTrap();
    }
    this.render();

    // 战斗 / 覆盖层返回
    this.events.on('resume', () => { this.hud.refresh(); this.render(); });

    game.save();
  }

  // ---------- 房间生成 ----------
  genRoom() {
    const type = RNG.weighted(roomWeightsFor(game.descended));
    if (type === 'monster') {
      return { type, monsterId: RNG.pick(monsterPoolFor(game.descended)), defeated: false, searched: false };
    }
    if (type === 'special') {
      return { type, sub: RNG.weighted({ rest: 4, cache: 4, trap: 3 }), done: false };
    }
    return { type, searched: false, opened: false };
  }

  maybeAutoTrap() {
    const r = game.currentRoom;
    if (r.type === 'special' && r.sub === 'trap' && !r.done) {
      const dmg = RNG.int(6, 14);
      game.hp = Phaser.Math.Clamp(game.hp - dmg, 0, game.maxHp);
      game.stamina = Phaser.Math.Clamp(game.stamina - 8, 0, game.maxStamina);
      r.done = true;
      SFX.hurt();
      this.log(`⚠ 你踩中了陷阱！受到 ${dmg} 点伤害。`);
      if (game.hp <= 0) { game.die(); }
    }
  }

  // ---------- 渲染 ----------
  render() {
    this.roomUI.removeAll(true);
    this.actionUI.removeAll(true);
    if (!game.alive) { this.toGameOver(); return; }

    const W = this.scale.width, H = this.scale.height;
    const cx = 672;
    // 房间舞台
    const pg = panel(this, 408, 108, W - 432, 306, { fill: 0x191926 });
    this.roomUI.add(pg);

    // 地砖（单行地面）
    for (let i = 0; i < 7; i++)
      this.roomUI.add(sprite(this, 444 + i * 64, 372, FRAMES.floor, 3));

    const r = game.currentRoom;
    let title = '', desc = '', centerFrame = FRAMES.doorOpen;

    if (r.type === 'empty') { title = '空房间'; desc = '一间凌乱的客房，也许有遗落的东西。'; centerFrame = FRAMES.crate; }
    else if (r.type === 'loot') { title = '物资间'; desc = '架子上还有没被拿光的补给！'; centerFrame = FRAMES.chestClosed; }
    else if (r.type === 'locked') { title = '上锁的房间'; desc = '门被反锁了。用铁管也许能撬开，里面应该有好东西。'; centerFrame = r.opened ? FRAMES.chestOpen : FRAMES.doorLocked; }
    else if (r.type === 'monster') {
      const m = MONSTERS[r.monsterId];
      title = r.defeated ? '战斗结束' : `遭遇：${m.name}`;
      desc = r.defeated ? '怪物已被击倒，搜刮它的残骸吧。' : `一只${m.name}挡住了去路！`;
      centerFrame = r.defeated ? FRAMES.chestClosed : m.frame;
    }
    else if (r.type === 'special') {
      if (r.sub === 'rest') { title = '安全角落'; desc = '一处可以喘口气的地方，稍作休息恢复状态。'; centerFrame = FRAMES.bed; }
      else if (r.sub === 'cache') { title = '隐藏缓存'; desc = '幸存者留下的补给箱，里头是稀有物资！'; centerFrame = FRAMES.chestClosed; }
      else { title = '陷阱房'; desc = '机关已经触发。快离开这里。'; centerFrame = FRAMES.trap; }
    }

    // 中央大图
    const big = sprite(this, cx, 220, centerFrame, 7);
    this.roomUI.add(big);
    this.roomUI.add(txt(this, cx, 130, title, 24, hex(COLORS.gold)).setOrigin(0.5));
    if (r.type === 'monster' && !r.defeated) {
      this.tweens.add({ targets: big, x: cx + 8, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const m = MONSTERS[r.monsterId];
      this.roomUI.add(txt(this, cx, 300, `HP ${m.hp} · 威胁 ${'★'.repeat(m.tier)}`, 13, COLORS.muted).setOrigin(0.5));
    }
    this.roomUI.add(txt(this, cx, 336, desc, 15, COLORS.text).setOrigin(0.5).setWordWrapWidth(W - 500).setAlign('center'));

    this.renderActions();
    this.hud.refresh();
  }

  renderActions() {
    const W = this.scale.width, H = this.scale.height;
    const r = game.currentRoom;
    const acts = [];     // [label, fn, opts]
    const cleared = this.isCleared(r);

    if (r.type === 'empty' && !r.searched) acts.push(['🔍 搜索房间', () => this.search('empty')]);
    if (r.type === 'loot' && !r.searched) acts.push(['📦 搜刮物资', () => this.search('loot')]);
    if (r.type === 'locked' && !r.opened) {
      const canPry = game.hasItem('pipe') || game.weaponId === 'pipe';
      acts.push([canPry ? '🗝 撬锁' : '🗝 撬锁（需铁管）', () => this.pry(), { enabled: canPry }]);
    }
    if (r.type === 'monster' && !r.defeated) {
      acts.push(['⚔ 战斗', () => this.fight(), { fill: COLORS.accentDim, hover: COLORS.accent }]);
      acts.push(['🏃 尝试逃跑', () => this.flee()]);
    }
    if (r.type === 'monster' && r.defeated && !r.searched) acts.push(['💀 搜刮战利品', () => this.search('monster')]);
    if (r.type === 'special' && r.sub === 'rest' && !r.done) acts.push(['😮‍💨 休息', () => this.rest()]);
    if (r.type === 'special' && r.sub === 'cache' && !r.done) acts.push(['🎁 打开缓存', () => this.openCache()]);

    // 通用行动
    if (cleared || r.type !== 'monster') acts.push(['⬇ 继续下楼', () => this.goDeeper(), { fill: COLORS.accentDim, hover: COLORS.accent }]);
    acts.push(['🎒 背包', () => this.openInventory()]);
    acts.push(['🏠 返回基地', () => this.scene.start('Base')]);

    // 布局：舞台下方竖排
    let by = 438;
    const bx = 672;
    acts.forEach(([label, fn, opts = {}]) => {
      const b = button(this, bx, by, 300, 40, label, fn, { size: 16, ...opts });
      if (opts.enabled === false) b.setEnabled(false);
      this.actionUI.add(b);
      by += 44;
    });
  }

  isCleared(r) {
    if (r.type === 'monster') return r.defeated;
    return true; // 其它房间可随时离开
  }

  // ---------- 行动 ----------
  search(kind) {
    const r = game.currentRoom;
    r.searched = true;
    game.spendStamina(BALANCE.searchStamina);
    let items;
    if (kind === 'empty') items = RNG.chance(0.55) ? this.rollLoot(1) : [];
    else if (kind === 'loot') items = this.rollLoot(RNG.int(2, 3));
    else items = this.rollLoot(RNG.int(1, 2)); // monster
    if (items.length === 0) this.log('什么都没找到。');
    else { SFX.loot(); this.giveLoot(items); }
    this.afterAction();
  }

  pry() {
    const r = game.currentRoom;
    r.opened = true;
    game.spendStamina(6);
    SFX.loot();
    const items = this.rollRare(RNG.int(2, 3));
    this.log('🗝 你撬开了门锁！');
    this.giveLoot(items);
    this.afterAction();
  }

  rest() {
    const r = game.currentRoom;
    r.done = true;
    const hp = Math.round(game.maxHp * 0.2), st = Math.round(game.maxStamina * 0.3);
    game.hp = Phaser.Math.Clamp(game.hp + hp, 0, game.maxHp);
    game.stamina = Phaser.Math.Clamp(game.stamina + st, 0, game.maxStamina);
    SFX.heal();
    this.log(`你休息了一会儿，生命 +${hp}，体力 +${st}。`);
    this.afterAction();
  }

  openCache() {
    const r = game.currentRoom;
    r.done = true;
    SFX.loot();
    const items = this.rollRare(RNG.int(2, 4));
    this.log('🎁 缓存里全是好东西！');
    this.giveLoot(items);
    this.afterAction();
  }

  fight() {
    this.scene.pause();
    this.scene.launch('Combat', { from: 'Explore' });
  }

  flee() {
    const r = game.currentRoom;
    const m = MONSTERS[r.monsterId];
    const p = Phaser.Math.Clamp(BALANCE.fleeBase + game.dex * 0.04 - m.tier * 0.05, 0.1, 0.92);
    game.spendStamina(5);
    if (RNG.chance(p)) {
      r.defeated = true; r.searched = true; // 逃走：清场但无战利品
      this.log(`🏃 你成功避开了${m.name}！`);
    } else {
      const dmg = Math.max(1, RNG.int(m.dmg[0], m.dmg[1]) - game.defense);
      game.hp = Phaser.Math.Clamp(game.hp - dmg, 0, game.maxHp);
      SFX.hurt();
      this.log(`逃跑失败！${m.name}咬了你一口，受到 ${dmg} 点伤害。`);
      if (game.hp <= 0) game.die();
    }
    this.afterAction();
  }

  goDeeper() {
    SFX.descend();
    game.descend();
    if (game.won) { this.scene.start('GameOver'); return; }
    if (!game.alive) { this.toGameOver(); return; }
    game.currentRoom = this.genRoom();
    game.roomFloor = game.floor;
    this.log(`—— 下到第 ${game.floor} 层 ——`);
    this.maybeAutoTrap();
    game.save();
    this.render();
  }

  openInventory() { this.scene.pause(); this.scene.launch('Inventory', { from: 'Explore' }); }

  // ---------- 战利品 ----------
  rollLoot(times) {
    const out = {};
    for (let i = 0; i < times; i++) {
      const e = RNG.weighted(LOOT_TABLE);
      const n = RNG.int(e.n[0], e.n[1]);
      out[e.id] = (out[e.id] || 0) + n;
    }
    return Object.entries(out);
  }
  rollRare(times) {
    const out = {};
    for (let i = 0; i < times; i++) {
      const id = RNG.pick(RARE_LOOT);
      out[id] = (out[id] || 0) + 1;
    }
    return Object.entries(out);
  }
  giveLoot(items) {
    for (const [id, n] of items) {
      const ok = game.addItem(id, n);
      if (ok) this.log(`获得 ${ITEMS[id].name} ×${n}`);
      else this.log(`背包已满，无法拾取 ${ITEMS[id].name}。`);
    }
  }

  afterAction() {
    this.hud.refresh();
    game.save();
    if (!game.alive) { this.toGameOver(); return; }
    this.render();
  }

  log(msg) {
    this.logLines.push(msg);
    if (this.logLines.length > 14) this.logLines.shift();
    this.logText.setText(this.logLines.join('\n'));
  }

  toGameOver() { SFX.die(); this.scene.start('GameOver'); }
}
