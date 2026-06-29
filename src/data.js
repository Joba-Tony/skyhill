// ============================================================================
// data.js — 所有游戏内容（精灵帧 / 职业 / 物品 / 怪物 / 配方 / 房间 / 平衡）
// 集中放在一处，方便查阅和调整数值。素材来自 Kenney Tiny Dungeon (CC0)。
// 精灵表 assets/tilemap.png 为 16x16、每行 12 个、无间距 → 帧号 = 行*12 + 列。
// ============================================================================

// ---- 精灵帧号（见 README 的帧索引图）----
export const FRAMES = {
  // 角色
  guard: 96, engineer: 100, athlete: 99,
  // 环境/家具
  floor: 30, floorAlt: 13, wall: 2, wall2: 3,
  doorClosed: 45, doorLocked: 33, doorOpen: 47,
  stairs: 18, ladder: 63, chestClosed: 89, chestOpen: 91,
  trap: 41, altar: 31, anvil: 74, table: 72, bed: 66, crate: 67,
  // 怪物
  rat: 109, slime: 108, hound: 120, bug: 122, ghoul: 121,
  brute: 111, imp: 110, golem: 124, mutant: 112,
  // 物品
  dagger: 103, knife: 106, club: 107, sword: 104, axe: 118,
  greatsword: 105, hammer: 117, shield: 102,
  potRed: 115, potBlue: 116, potGreen: 114, potClear: 113,
  scrap: 101, chem: 56,
};

// ---- 职业 ----
export const CLASSES = [
  {
    id: 'guard', name: '保安', frame: FRAMES.guard,
    desc: '高生命与近战。开局自带警棍与医疗包，肉搏首选。',
    stats: { maxHp: 120, maxStamina: 90, str: 8, acc: 6, dex: 5, int: 3 },
    weapon: 'club',
    items: [['medkit', 1], ['ration', 2]],
  },
  {
    id: 'engineer', name: '工程师', frame: FRAMES.engineer,
    desc: '高智力。自带材料与合成天赋，能把废料变装备。',
    stats: { maxHp: 90, maxStamina: 90, str: 4, acc: 6, dex: 5, int: 9 },
    weapon: 'dagger',
    items: [['scrap', 4], ['chem', 2], ['ration', 1]],
  },
  {
    id: 'athlete', name: '运动员', frame: FRAMES.athlete,
    desc: '高敏捷与体力。行动消耗低、闪避高、逃跑成功率高。',
    stats: { maxHp: 100, maxStamina: 120, str: 6, acc: 7, dex: 9, int: 4 },
    weapon: 'dagger',
    items: [['energy', 2], ['ration', 1]],
  },
];

// ---- 物品 ----
// type: weapon | armor | consumable | material
export const ITEMS = {
  // 武器（dmg = [最小,最大]，acc = 命中修正）
  fist:       { name: '拳头',   type: 'weapon', dmg: [2, 4],  acc: 0,  frame: -1, base: true },
  dagger:     { name: '匕首',   type: 'weapon', dmg: [4, 7],  acc: 2,  frame: FRAMES.dagger },
  knife:      { name: '尖刀',   type: 'weapon', dmg: [5, 9],  acc: 1,  frame: FRAMES.knife },
  club:       { name: '警棍',   type: 'weapon', dmg: [6, 10], acc: 0,  frame: FRAMES.club },
  pipe:       { name: '铁管',   type: 'weapon', dmg: [7, 11], acc: -1, frame: FRAMES.club },
  sword:      { name: '砍刀',   type: 'weapon', dmg: [8, 13], acc: 1,  frame: FRAMES.sword },
  axe:        { name: '消防斧', type: 'weapon', dmg: [10, 15],acc: -1, frame: FRAMES.axe },
  greatsword: { name: '长剑',   type: 'weapon', dmg: [12, 18],acc: 0,  frame: FRAMES.greatsword },
  hammer:     { name: '大锤',   type: 'weapon', dmg: [13, 20],acc: -3, frame: FRAMES.hammer },
  // 护具
  shield:     { name: '防暴盾', type: 'armor', defense: 3, frame: FRAMES.shield },
  // 消耗品（effect 在 state.useItem 中处理）
  medkit:  { name: '医疗包',   type: 'consumable', frame: FRAMES.potRed,   heal: 45 },
  energy:  { name: '能量饮料', type: 'consumable', frame: FRAMES.potBlue,  stamina: 45 },
  ration:  { name: '罐头食物', type: 'consumable', frame: FRAMES.potGreen, hunger: -35, heal: 5 },
  meal:    { name: '热食',     type: 'consumable', frame: FRAMES.potGreen, hunger: -55, heal: 12, stamina: 15 },
  water:   { name: '净水',     type: 'consumable', frame: FRAMES.potClear, hunger: -12, stamina: 8 },
  // 材料
  scrap:   { name: '废铁',     type: 'material', frame: FRAMES.scrap },
  chem:    { name: '化学剂',   type: 'material', frame: FRAMES.chem },
};

// ---- 合成配方 ----
// station: 'workbench'（工作台） | 'stove'（炉灶）
export const RECIPES = [
  { id: 'pipe',   out: ['pipe', 1],   station: 'workbench', cost: [['scrap', 2]],            desc: '废铁敲成趁手的铁管' },
  { id: 'knife',  out: ['knife', 1],  station: 'workbench', cost: [['scrap', 3]],            desc: '磨一把锋利尖刀' },
  { id: 'shield', out: ['shield', 1], station: 'workbench', cost: [['scrap', 4]],            desc: '焊一面防暴盾' },
  { id: 'medkit', out: ['medkit', 1], station: 'workbench', cost: [['chem', 2]],             desc: '用化学剂配制医疗包' },
  { id: 'meal',   out: ['meal', 1],   station: 'stove',     cost: [['ration', 1], ['chem', 1]], desc: '加热罐头做成热食' },
  { id: 'energy', out: ['energy', 1], station: 'stove',     cost: [['chem', 2]],             desc: '调一瓶提神能量饮料' },
];

// ---- 怪物 ----
// tier 越高越危险；hp/dmg/acc/eva/armor/xp；poison 表示攻击附带中毒
export const MONSTERS = {
  rat:    { name: '变异鼠',   frame: FRAMES.rat,    tier: 1, hp: 14,  dmg: [2, 5],   acc: 5, eva: 4, armor: 0, xp: 4 },
  slime:  { name: '毒黏怪',   frame: FRAMES.slime,  tier: 1, hp: 20,  dmg: [3, 6],   acc: 4, eva: 1, armor: 0, xp: 6, poison: true },
  hound:  { name: '变异犬',   frame: FRAMES.hound,  tier: 2, hp: 26,  dmg: [4, 8],   acc: 7, eva: 6, armor: 0, xp: 9 },
  bug:    { name: '装甲虫',   frame: FRAMES.bug,    tier: 2, hp: 32,  dmg: [3, 7],   acc: 5, eva: 2, armor: 3, xp: 10 },
  ghoul:  { name: '食尸鬼',   frame: FRAMES.ghoul,  tier: 3, hp: 40,  dmg: [6, 11],  acc: 6, eva: 3, armor: 1, xp: 14 },
  brute:  { name: '狂暴者',   frame: FRAMES.brute,  tier: 3, hp: 56,  dmg: [8, 14],  acc: 6, eva: 2, armor: 1, xp: 18 },
  imp:    { name: '恶魔',     frame: FRAMES.imp,    tier: 4, hp: 46,  dmg: [7, 13],  acc: 8, eva: 7, armor: 0, xp: 22, poison: true },
  golem:  { name: '石魔',     frame: FRAMES.golem,  tier: 4, hp: 82,  dmg: [10, 16], acc: 5, eva: 0, armor: 5, xp: 28 },
  mutant: { name: '变异首领', frame: FRAMES.mutant, tier: 5, hp: 140, dmg: [12, 20], acc: 8, eva: 4, armor: 3, xp: 60, boss: true },
};

// 按「已下降层数」划分怪物出现池
export function monsterPoolFor(descended) {
  if (descended < 16) return ['rat', 'rat', 'slime'];
  if (descended < 35) return ['rat', 'slime', 'hound', 'bug'];
  if (descended < 55) return ['hound', 'bug', 'ghoul', 'slime'];
  if (descended < 75) return ['ghoul', 'brute', 'bug', 'imp'];
  if (descended < 92) return ['brute', 'imp', 'golem', 'ghoul'];
  return ['imp', 'golem', 'brute', 'mutant'];
}

// ---- 房间类型与权重（随深度调整）----
export const ROOM_TYPES = ['empty', 'loot', 'monster', 'locked', 'special'];
export function roomWeightsFor(descended) {
  const t = descended / 100; // 0→1 越深怪越多
  return {
    empty:   18 - 8 * t,
    loot:    26 - 6 * t,
    monster: 30 + 22 * t,
    locked:  10,
    special: 12,
  };
}

// 掉落表（房间/怪物搜刮），权重 + 数量范围
export const LOOT_TABLE = [
  { id: 'ration', w: 22, n: [1, 2] },
  { id: 'water',  w: 16, n: [1, 2] },
  { id: 'scrap',  w: 20, n: [1, 3] },
  { id: 'chem',   w: 14, n: [1, 2] },
  { id: 'medkit', w: 9,  n: [1, 1] },
  { id: 'energy', w: 9,  n: [1, 1] },
  { id: 'dagger', w: 4,  n: [1, 1] },
  { id: 'club',   w: 3,  n: [1, 1] },
  { id: 'sword',  w: 3,  n: [1, 1] },
  { id: 'axe',    w: 2,  n: [1, 1] },
];

// 上锁房 / 宝箱的高价值掉落
export const RARE_LOOT = ['sword', 'axe', 'greatsword', 'hammer', 'shield', 'medkit', 'medkit', 'energy', 'meal'];

// ---- 全局平衡参数 ----
export const BALANCE = {
  startFloor: 100,
  exitFloor: 1,
  descendStamina: 6,      // 下楼基础体力消耗
  searchStamina: 4,       // 搜刮体力消耗
  hungerPerFloor: 2,      // 每下一层增加饥饿
  hungerSleep: 20,        // 睡觉增加的饥饿
  sleepHeal: 22,          // 睡觉恢复 HP
  starvingDmg: 3,         // 饥饿满值时每回合掉血
  exhaustDmg: 2,          // 体力耗尽时行动掉血
  fleeBase: 0.40,         // 逃跑基础成功率
  invSlots: 16,           // 背包格子数（不同物品占 1 格，可堆叠）
};
