// ============================================================================
// combat.js — 战斗核心数值（纯函数）。战斗场景与平衡模拟器共用，保证一致。
// ============================================================================
import { RNG } from './state.js';
import { MONSTERS } from './data.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 按已下降层数对怪物进行轻度成长，返回运行时实例
export function scaleMonster(id, descended) {
  const base = MONSTERS[id];
  const f = 1 + descended * 0.010;
  return {
    ...base, id,
    maxHp: Math.round(base.hp * f),
    hp: Math.round(base.hp * f),
    dmg: [
      Math.round(base.dmg[0] * (1 + descended * 0.008)),
      Math.round(base.dmg[1] * (1 + descended * 0.011)),
    ],
  };
}

export function playerHitChance(game, mon) {
  return clamp(0.6 + (game.attackAcc - mon.eva) * 0.04, 0.15, 0.95);
}
export function monsterHitChance(game, mon) {
  return clamp(0.55 + (mon.acc - game.evasion) * 0.04, 0.1, 0.92);
}
export function playerDamage(game, mon) {
  return Math.max(1, game.rollDamage() - mon.armor);
}
export function monsterDamage(game, mon, defending) {
  let d = Math.max(1, RNG.int(mon.dmg[0], mon.dmg[1]) - game.defense);
  return defending ? Math.ceil(d / 2) : d;
}
