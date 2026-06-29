// ============================================================================
// state.js — 游戏状态模型、背包/合成/下楼/睡觉逻辑、存档读写、随机数工具
// ============================================================================
import { ITEMS, RECIPES, BALANCE, CLASSES } from './data.js';

// ---------- 随机数工具 ----------
export const RNG = {
  int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  float: (min, max) => Math.random() * (max - min) + min,
  chance: (p) => Math.random() < p,
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  // 加权挑选：weights 为 {key:weight} 或 [{...,w}]
  weighted(map) {
    const entries = Array.isArray(map) ? map.map(o => [o, o.w]) : Object.entries(map);
    let total = 0;
    for (const [, w] of entries) total += Math.max(0, w);
    let r = Math.random() * total;
    for (const [k, w] of entries) { r -= Math.max(0, w); if (r <= 0) return k; }
    return entries[0][0];
  },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const SAVE_KEY = 'skyhill_save_v1';

// ---------- 游戏状态 ----------
export class GameState {
  constructor() { this.reset(); }

  reset() {
    this.classId = null; this.className = ''; this.frame = 0;
    this.maxHp = 100; this.hp = 100;
    this.maxStamina = 100; this.stamina = 100;
    this.hunger = 0;            // 0 = 饱，100 = 饿死边缘
    this.str = 5; this.acc = 5; this.dex = 5; this.int = 5;
    this.floor = BALANCE.startFloor;
    this.descended = 0;        // 已下降层数
    this.day = 1;
    this.weaponId = 'fist';
    this.armorId = null;
    this.inv = [];             // [{id, n}]
    this.poison = 0;           // 剩余中毒回合
    this.kills = 0;
    this.alive = true;
    this.won = false;
  }

  // ---------- 初始化角色 ----------
  initClass(cls) {
    this.classId = cls.id; this.className = cls.name; this.frame = cls.frame;
    const s = cls.stats;
    this.maxHp = s.maxHp; this.hp = s.maxHp;
    this.maxStamina = s.maxStamina; this.stamina = s.maxStamina;
    this.str = s.str; this.acc = s.acc; this.dex = s.dex; this.int = s.int;
    this.weaponId = cls.weapon || 'fist';
    this.inv = [];
    for (const [id, n] of (cls.items || [])) this.addItem(id, n);
  }

  // ---------- 背包 ----------
  get distinctCount() { return this.inv.length; }
  countItem(id) { const s = this.inv.find(s => s.id === id); return s ? s.n : 0; }
  hasItem(id, n = 1) { return this.countItem(id) >= n; }

  addItem(id, n = 1) {
    if (!ITEMS[id]) return false;
    const s = this.inv.find(s => s.id === id);
    if (s) { s.n += n; return true; }
    if (this.inv.length >= BALANCE.invSlots) return false; // 背包满
    this.inv.push({ id, n });
    return true;
  }

  removeItem(id, n = 1) {
    const i = this.inv.findIndex(s => s.id === id);
    if (i < 0 || this.inv[i].n < n) return false;
    this.inv[i].n -= n;
    if (this.inv[i].n <= 0) this.inv.splice(i, 1);
    return true;
  }

  // 装备武器/护具：原装备退回背包
  equip(id) {
    const it = ITEMS[id];
    if (!it) return false;
    if (it.type === 'weapon') {
      if (!this.removeItem(id, 1)) return false;
      if (this.weaponId && this.weaponId !== 'fist') this.addItem(this.weaponId, 1);
      this.weaponId = id;
      return true;
    }
    if (it.type === 'armor') {
      if (!this.removeItem(id, 1)) return false;
      if (this.armorId) this.addItem(this.armorId, 1);
      this.armorId = id;
      return true;
    }
    return false;
  }

  // 使用消耗品，返回描述效果的字符串数组（用于日志）
  useItem(id) {
    const it = ITEMS[id];
    if (!it || it.type !== 'consumable' || !this.hasItem(id)) return null;
    this.removeItem(id, 1);
    const log = [];
    if (it.heal) { const before = this.hp; this.hp = clamp(this.hp + it.heal, 0, this.maxHp); log.push(`生命 +${this.hp - before}`); }
    if (it.stamina) { const before = this.stamina; this.stamina = clamp(this.stamina + it.stamina, 0, this.maxStamina); log.push(`体力 +${this.stamina - before}`); }
    if (it.hunger) { const before = this.hunger; this.hunger = clamp(this.hunger + it.hunger, 0, 100); log.push(`饥饿 ${this.hunger - before}`); }
    return { name: it.name, log };
  }

  // ---------- 合成 ----------
  recipesFor(station) { return RECIPES.filter(r => r.station === station); }
  canCraft(r) {
    return r.cost.every(([id, n]) => this.hasItem(id, n)) &&
      (this.inv.find(s => s.id === r.out[0]) || this.inv.length < BALANCE.invSlots);
  }
  craft(r) {
    if (!this.canCraft(r)) return false;
    // 智力影响成功率
    const success = RNG.chance(clamp(0.55 + this.int * 0.05, 0.5, 0.98));
    for (const [id, n] of r.cost) this.removeItem(id, n);
    if (success) { this.addItem(r.out[0], r.out[1]); return { ok: true }; }
    return { ok: false }; // 失败：材料损耗
  }

  // ---------- 行动 / 时间 / 饥饿 ----------
  staminaCost(base) {
    // 敏捷降低消耗（运动员更省）
    return Math.max(1, Math.round(base * (1 - this.dex * 0.02)));
  }

  spendStamina(base) {
    const cost = this.staminaCost(base);
    if (this.stamina >= cost) { this.stamina -= cost; return false; }
    // 体力不足：强行行动，差额转化为掉血（精疲力竭）
    const deficit = cost - this.stamina;
    this.stamina = 0;
    this.hp = clamp(this.hp - Math.ceil(deficit / 3) - BALANCE.exhaustDmg, 0, this.maxHp);
    if (this.hp <= 0) this.die();
    return true; // 表示发生了精疲力竭
  }

  // 推进时间：增加饥饿、处理饥饿惩罚
  advance(hunger = BALANCE.hungerPerFloor) {
    this.hunger = clamp(this.hunger + hunger, 0, 100);
    if (this.hunger >= 100) {
      this.hp = clamp(this.hp - BALANCE.starvingDmg, 0, this.maxHp);
      if (this.hp <= 0) this.die();
    }
  }

  descend() {
    if (!this.alive) return;
    this.spendStamina(BALANCE.descendStamina);
    this.floor = Math.max(BALANCE.exitFloor, this.floor - 1);
    this.descended += 1;
    this.advance();
    if (this.floor <= BALANCE.exitFloor) this.won = true;
  }

  sleep() {
    const regen = this.hunger >= 100 ? 0.5 : 1; // 饥饿时恢复减半
    this.stamina = this.maxStamina;
    this.hp = clamp(this.hp + Math.round(BALANCE.sleepHeal * regen), 0, this.maxHp);
    this.day += 1;
    this.advance(BALANCE.hungerSleep);
  }

  die() { this.hp = 0; this.alive = false; }

  // ---------- 战斗数值 ----------
  get weapon() { return ITEMS[this.weaponId] || ITEMS.fist; }
  get defense() { return this.armorId ? (ITEMS[this.armorId].defense || 0) : 0; }
  rollDamage() {
    const w = this.weapon;
    return RNG.int(w.dmg[0], w.dmg[1]) + Math.floor(this.str / 2);
  }
  get attackAcc() { return this.acc + (this.weapon.acc || 0); }
  get evasion() { return this.dex; }

  // ---------- 存档 ----------
  toJSON() {
    return {
      classId: this.classId, className: this.className, frame: this.frame,
      maxHp: this.maxHp, hp: this.hp, maxStamina: this.maxStamina, stamina: this.stamina,
      hunger: this.hunger, str: this.str, acc: this.acc, dex: this.dex, int: this.int,
      floor: this.floor, descended: this.descended, day: this.day,
      weaponId: this.weaponId, armorId: this.armorId, inv: this.inv,
      poison: this.poison, kills: this.kills, alive: this.alive, won: this.won,
    };
  }
  fromJSON(d) { Object.assign(this, d); return this; }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.toJSON())); } catch (e) {}
  }
  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || !d.alive || d.won) return null; // 已死亡/通关不可继续
      return new GameState().fromJSON(d);
    } catch (e) { return null; }
  }
  static hasSave() { return !!GameState.load(); }
  static clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
}

// 当前游戏状态（单例，供各场景共享）
export const game = new GameState();

export function classById(id) { return CLASSES.find(c => c.id === id); }
