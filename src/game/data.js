// ============================================================================
// data.js — 末世幸存者：调色板 / 敌人 / 武器 / 强化 / 平衡参数（集中调数值）
// ============================================================================

export const PAL = {
  bg: 0x07070e,
  grid: 0x14142a,
  player: 0x53e0ff,
  playerGlow: 0x9ff0ff,
  bolt: 0xfff27a,
  spread: 0xffb14a,
  orbit: 0x7afcff,
  nova: 0x6affc0,
  gem: 0x8cff5c,
  hp: 0xff4d6d,
  white: 0xffffff,
};

// ---- 敌人类型 ----
// r 半径, hp 生命, speed px/s, dmg 接触伤害, xp 经验, color 颜色
export const ENEMIES = {
  walker: { name: '行尸',   color: 0xff5c8a, r: 15, hp: 12,  speed: 52,  dmg: 8,  xp: 1 },
  runner: { name: '疾行者', color: 0xb98cff, r: 12, hp: 7,   speed: 118, dmg: 6,  xp: 1 },
  swarm:  { name: '虫群',   color: 0x6bffd0, r: 9,  hp: 4,   speed: 86,  dmg: 4,  xp: 1 },
  brute:  { name: '重装',   color: 0xff9a3c, r: 26, hp: 75,  speed: 40,  dmg: 16, xp: 5 },
  boss:   { name: '变异领主', color: 0xff3b3b, r: 46, hp: 1500, speed: 34, dmg: 28, xp: 80, boss: true },
};

// 按存活分钟数决定可出怪种与生成节奏
export function spawnTableFor(minutes) {
  if (minutes < 1) return ['walker'];
  if (minutes < 2) return ['walker', 'walker', 'runner'];
  if (minutes < 4) return ['walker', 'runner', 'runner', 'swarm'];
  if (minutes < 6) return ['walker', 'runner', 'swarm', 'swarm', 'brute'];
  return ['runner', 'swarm', 'brute', 'brute', 'walker'];
}

// 敌人随时间成长
export function enemyScale(minutes) {
  return { hp: 1 + minutes * 0.55, speed: 1 + minutes * 0.03, dmg: 1 + minutes * 0.12 };
}

// 每隔几分钟刷 Boss
export const BOSS_EVERY_MIN = 3;

// ---- 武器 ----
// 每把武器有等级，stat() 根据等级返回当前数值
export const WEAPONS = {
  bolt: {
    name: '钉枪', color: PAL.bolt, max: 7,
    desc: '自动射击最近的敌人',
    stat: (lv) => ({ dmg: 5 + lv * 2, cd: Math.max(140, 560 - lv * 55), count: 1 + Math.floor(lv / 3), speed: 560, pierce: Math.floor(lv / 4), r: 5 }),
  },
  spread: {
    name: '霰弹', color: PAL.spread, max: 7,
    desc: '扇形喷射多发弹丸',
    stat: (lv) => ({ dmg: 4 + lv * 1.6, cd: Math.max(420, 1000 - lv * 70), count: 4 + lv, arc: 46 + lv * 3, speed: 470, pierce: 0, r: 5 }),
  },
  orbit: {
    name: '环刃', color: PAL.orbit, max: 7,
    desc: '环绕自身旋转的利刃',
    stat: (lv) => ({ dmg: 6 + lv * 2.4, blades: 2 + Math.floor((lv + 1) / 2), radius: 78 + lv * 6, rot: 2.2 + lv * 0.12, r: 13 }),
  },
  nova: {
    name: '冲击波', color: PAL.nova, max: 7,
    desc: '周期性向四周释放冲击',
    stat: (lv) => ({ dmg: 10 + lv * 4, cd: Math.max(1100, 2800 - lv * 230), radius: 120 + lv * 18 }),
  },
};

// ---- 被动强化 ----
// apply(player) 修改玩家属性；可重复获取（stacks）直到 cap
export const PASSIVES = {
  maxhp:    { name: '强韧体魄', desc: '最大生命 +25', cap: 8, color: PAL.hp,     apply: p => { p.maxHp += 25; p.hp += 25; } },
  speed:    { name: '迅捷',     desc: '移动速度 +12%', cap: 6, color: PAL.player, apply: p => { p.moveSpeed *= 1.12; } },
  damage:   { name: '强力',     desc: '全武器伤害 +15%', cap: 8, color: PAL.bolt, apply: p => { p.dmgMul *= 1.15; } },
  firerate: { name: '急速射击', desc: '攻击频率 +12%', cap: 8, color: PAL.spread, apply: p => { p.fireMul *= 0.88; } },
  magnet:   { name: '磁力拾取', desc: '拾取范围 +40%', cap: 5, color: PAL.gem,    apply: p => { p.magnet *= 1.4; } },
  regen:    { name: '再生',     desc: '每秒回血 +1', cap: 6, color: PAL.hp,        apply: p => { p.regen += 1; } },
  armor:    { name: '护甲',     desc: '受到伤害 -2', cap: 6, color: 0xc0c8d8,      apply: p => { p.armor += 2; } },
  xp:       { name: '学识',     desc: '经验获取 +20%', cap: 6, color: PAL.nova,    apply: p => { p.xpMul *= 1.2; } },
};

export const BALANCE = {
  playerR: 14,
  baseSpeed: 210,
  baseMaxHp: 100,
  baseMagnet: 160,
  xpFirst: 5,
  xpGrow: 1.32,
  spawnBaseCd: 760,     // ms，随时间变快
  spawnMin: 150,
  maxEnemies: 150,
  contactIFrame: 450,   // 受击无敌帧 ms
};
