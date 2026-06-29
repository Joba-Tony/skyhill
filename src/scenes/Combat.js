// Combat — 回合制战斗（攻击 / 防御 / 物品 / 逃跑）
import { COLORS, txt, button, sprite, panel, SFX, hex } from '../ui.js';
import { MONSTERS, ITEMS, BALANCE } from '../data.js';
import { game, RNG } from '../state.js';

export class Combat extends Phaser.Scene {
  constructor() { super('Combat'); }

  init(data) { this.from = data.from || 'Explore'; }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor(0x10101a);
    this.busy = false;

    // 怪物运行时实例（按深度轻度成长）
    const base = MONSTERS[game.currentRoom.monsterId];
    const f = 1 + game.descended * 0.012;
    this.mon = {
      ...base,
      maxHp: Math.round(base.hp * f),
      hp: Math.round(base.hp * f),
      dmg: [Math.round(base.dmg[0] * (1 + game.descended * 0.006)), Math.round(base.dmg[1] * (1 + game.descended * 0.008))],
    };

    txt(this, W / 2, 36, '⚔  战 斗', 28, hex(COLORS.gold)).setOrigin(0.5);

    // 玩家
    sprite(this, 250, 220, game.frame, 7);
    txt(this, 250, 300, game.className, 16, COLORS.text).setOrigin(0.5);
    this.pBar = this.entityBar(250, 320, COLORS.hp);

    // 怪物
    this.monSprite = sprite(this, W - 250, 220, this.mon.frame, 7);
    txt(this, W - 250, 300, this.mon.name + (this.mon.boss ? ' 👑' : ''), 16, COLORS.bad).setOrigin(0.5);
    this.mBar = this.entityBar(W - 250, 320, COLORS.bad);
    txt(this, W - 250, 344, `威胁 ${'★'.repeat(this.mon.tier)}`, 12, COLORS.muted).setOrigin(0.5);

    txt(this, W / 2, 230, 'VS', 30, COLORS.muted).setOrigin(0.5);

    // 日志
    panel(this, 24, 370, W - 48, 130, { fill: COLORS.panel });
    this.logLines = [];
    this.logText = txt(this, 40, 384, '', 13, COLORS.text).setWordWrapWidth(W - 80).setLineSpacing(4);
    this.log(`你遭遇了 ${this.mon.name}！`);

    // 行动按钮
    this.actionUI = this.add.container(0, 0);
    this.drawActions();
    this.refresh();
  }

  entityBar(x, y, color) {
    const w = 180;
    const bg = this.add.graphics(); bg.fillStyle(0x000000, 0.4); bg.fillRoundedRect(x - w / 2, y, w, 16, 5);
    const fill = this.add.graphics();
    const val = txt(this, x, y - 1, '', 12, COLORS.text).setOrigin(0.5, 0);
    return { x, y, w, fill, val, color };
  }
  setBar(bar, v, max) {
    const pct = max > 0 ? Phaser.Math.Clamp(v / max, 0, 1) : 0;
    bar.fill.clear(); bar.fill.fillStyle(bar.color, 1);
    if (pct > 0) bar.fill.fillRoundedRect(bar.x - bar.w / 2 + 2, bar.y + 2, Math.max(3, (bar.w - 4) * pct), 12, 4);
    bar.val.setText(`${Math.round(v)}/${max}`);
  }
  refresh() {
    this.setBar(this.pBar, game.hp, game.maxHp);
    this.setBar(this.mBar, this.mon.hp, this.mon.maxHp);
  }

  drawActions() {
    this.actionUI.removeAll(true);
    const W = this.scale.width, y = 540;
    const labels = [
      ['⚔ 攻击', () => this.playerTurn('attack'), { fill: COLORS.accentDim, hover: COLORS.accent }],
      ['🛡 防御', () => this.playerTurn('defend')],
      ['🧪 物品', () => this.openItems()],
      ['🏃 逃跑', () => this.tryFlee()],
    ];
    let x = W / 2 - 1.5 * 175;
    labels.forEach(([l, fn, opts = {}]) => {
      const b = button(this, x, y, 160, 46, l, () => { if (!this.busy) fn(); }, { size: 17, ...opts });
      this.actionUI.add(b); x += 175;
    });
  }

  // ---------- 玩家回合 ----------
  playerTurn(kind, payload) {
    if (this.busy || !game.alive) return;
    this.busy = true;
    this.tickPoison();
    if (!game.alive) { this.refresh(); return this.defeat(); }

    if (kind === 'attack') this.playerAttack();
    else if (kind === 'defend') { this.defending = true; game.stamina = Phaser.Math.Clamp(game.stamina + 8, 0, game.maxStamina); this.log('🛡 你举盾防御，下次受伤减半。'); }
    else if (kind === 'item') this.useItem(payload);

    this.refresh();
    if (this.mon.hp <= 0) return this.victory();
    this.time.delayedCall(500, () => this.monsterTurn());
  }

  playerAttack() {
    const exhausted = game.spendStamina(3);
    const hitChance = Phaser.Math.Clamp(0.6 + (game.attackAcc - this.mon.eva) * 0.04, 0.15, 0.95);
    if (RNG.chance(hitChance)) {
      const dmg = Math.max(1, game.rollDamage() - this.mon.armor);
      this.mon.hp -= dmg;
      SFX.hit();
      this.shake(this.monSprite);
      this.log(`你用${game.weapon.name}命中，造成 ${dmg} 点伤害。` + (exhausted ? '（精疲力竭！）' : ''));
    } else {
      this.log('你挥空了……');
    }
  }

  useItem(id) {
    const res = game.useItem(id);
    if (res) { SFX.heal(); this.log(`使用 ${res.name}：${res.log.join('，') || '无效果'}`); }
  }

  // ---------- 怪物回合 ----------
  monsterTurn() {
    if (!game.alive) return this.defeat();
    const hitChance = Phaser.Math.Clamp(0.55 + (this.mon.acc - game.evasion) * 0.04, 0.1, 0.92);
    if (RNG.chance(hitChance)) {
      let dmg = Math.max(1, RNG.int(this.mon.dmg[0], this.mon.dmg[1]) - game.defense);
      if (this.defending) dmg = Math.ceil(dmg / 2);
      game.hp = Phaser.Math.Clamp(game.hp - dmg, 0, game.maxHp);
      SFX.hurt();
      this.cameras.main.shake(120, 0.006);
      let msg = `${this.mon.name}攻击，你受到 ${dmg} 点伤害。`;
      if (this.mon.poison && RNG.chance(0.7)) { const t = RNG.int(2, 3); game.poison += t; msg += ` ☠ 中毒（${t} 回合）！`; }
      this.log(msg);
    } else {
      this.log(`${this.mon.name}的攻击被你躲开了。`);
    }
    this.defending = false;
    this.refresh();
    game.save();
    if (game.hp <= 0) { game.die(); return this.defeat(); }
    this.busy = false;
  }

  tickPoison() {
    if (game.poison > 0) {
      const d = RNG.int(1, 2);
      game.hp = Phaser.Math.Clamp(game.hp - d, 0, game.maxHp);
      game.poison -= 1;
      this.log(`☠ 中毒发作，损失 ${d} 点生命（剩余 ${game.poison} 回合）。`);
      if (game.hp <= 0) game.die();
    }
  }

  // ---------- 物品子菜单 ----------
  openItems() {
    if (this.busy) return;
    const consumables = game.inv.filter(s => ITEMS[s.id].type === 'consumable');
    if (consumables.length === 0) { this.log('没有可用的消耗品。'); return; }
    this.busy = true;
    const W = this.scale.width;
    const overlay = this.add.container(0, 0);
    const bg = this.add.graphics(); bg.fillStyle(0x000000, 0.6); bg.fillRect(0, 0, W, this.scale.height);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, this.scale.height), Phaser.Geom.Rectangle.Contains);
    overlay.add(bg);
    panel(this, W / 2 - 200, 150, 400, 60 + consumables.length * 50, { fill: COLORS.panel });
    overlay.add(txt(this, W / 2, 165, '使用物品', 18, COLORS.text).setOrigin(0.5));
    let y = 215;
    consumables.forEach(s => {
      const it = ITEMS[s.id];
      const b = button(this, W / 2, y, 340, 42, `${it.name} ×${s.n}`, () => {
        overlay.destroy(); this.busy = false;
        this.playerTurn('item', s.id);
      }, { size: 15, frame: it.frame });
      overlay.add(b); y += 50;
    });
    const close = button(this, W / 2, y + 6, 200, 36, '取消', () => { overlay.destroy(); this.busy = false; }, { size: 14 });
    overlay.add(close);
  }

  // ---------- 逃跑 ----------
  tryFlee() {
    if (this.busy) return;
    this.busy = true;
    const p = Phaser.Math.Clamp(BALANCE.fleeBase + game.dex * 0.04 - this.mon.tier * 0.05, 0.1, 0.92);
    game.spendStamina(5);
    if (RNG.chance(p)) {
      game.currentRoom.defeated = true; game.currentRoom.searched = true;
      this.log('🏃 你成功脱身！');
      this.time.delayedCall(500, () => this.endBattle());
    } else {
      this.log('逃跑失败！');
      this.time.delayedCall(400, () => this.monsterTurn());
    }
  }

  // ---------- 结算 ----------
  victory() {
    this.busy = true;
    game.currentRoom.defeated = true;
    game.kills += 1;
    SFX.loot();
    this.tweens.add({ targets: this.monSprite, alpha: 0, angle: 90, y: '+=20', duration: 400 });
    this.log(`✔ 你击败了 ${this.mon.name}！`);
    game.save();
    this.actionUI.removeAll(true);
    button(this, this.scale.width / 2, 540, 280, 48, '继续', () => this.endBattle(),
      { fill: COLORS.accentDim, hover: COLORS.accent, size: 18 });
  }

  defeat() {
    this.busy = true;
    game.die(); game.save();
    SFX.die();
    this.time.delayedCall(300, () => this.scene.start('GameOver'));
  }

  endBattle() {
    this.scene.stop();
    this.scene.resume(this.from);
  }

  log(msg) {
    this.logLines.push(msg);
    if (this.logLines.length > 6) this.logLines.shift();
    this.logText.setText(this.logLines.join('\n'));
  }

  shake(target) {
    this.tweens.add({ targets: target, x: target.x - 6, duration: 50, yoyo: true, repeat: 2 });
  }
}
