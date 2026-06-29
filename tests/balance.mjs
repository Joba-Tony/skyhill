// 平衡模拟器：用游戏自身的数据与战斗公式，让“称职玩家”AI 跑大量整局，统计胜率/死因/深度。
// 用法：先起 http.server 8080，再 node tests/balance.mjs [每职业局数]
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const N = parseInt(process.argv[2] || '400', 10);

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 800));

const report = await p.evaluate((N) => {
  const S = window.__SKYHILL__;
  const { GameState, RNG, Data, CombatMath } = S;
  const { ITEMS, MONSTERS, LOOT_TABLE, RARE_LOOT, BALANCE, roomWeightsFor, monsterPoolFor, RECIPES, CLASSES, BOSS_FLOORS, TRADES } = Data;
  const autoPerk = (g) => { while (g.pendingPerks > 0) g.applyPerk(g.maxHp < 115 ? 'hp' : (g.str < 8 ? 'str' : (g.dex < 7 ? 'dex' : 'acc'))); };
  const { scaleMonster, playerHitChance, monsterHitChance, playerDamage, monsterDamage } = CombatMath;

  const weaponAvg = id => { const w = ITEMS[id]; return w && w.type === 'weapon' ? (w.dmg[0] + w.dmg[1]) / 2 + (w.acc || 0) * 0.3 : 0; };
  const bestWeaponInInv = (g) => {
    let best = g.weaponId, bv = weaponAvg(g.weaponId);
    for (const s of g.inv) if (ITEMS[s.id].type === 'weapon' && weaponAvg(s.id) > bv) { best = s.id; bv = weaponAvg(s.id); }
    return best;
  };
  const rollLoot = (times) => { const o = {}; for (let i = 0; i < times; i++) { const e = RNG.weighted(LOOT_TABLE); o[e.id] = (o[e.id] || 0) + RNG.int(e.n[0], e.n[1]); } return Object.entries(o); };
  const rollRare = (times) => { const o = {}; for (let i = 0; i < times; i++) { const id = RNG.pick(RARE_LOOT); o[id] = (o[id] || 0) + 1; } return Object.entries(o); };
  const give = (g, items) => { for (const [id, n] of items) g.addItem(id, n); };
  const count = (g, id) => g.countItem(id);
  const foodCount = (g) => count(g, 'ration') + count(g, 'meal') + count(g, 'water');

  // 一场战斗（称职策略：低血用药，Boss 危急逃跑）
  function battle(g, monId) {
    const mon = scaleMonster(monId, g.descended);
    let defending = false, guard = 0;
    while (mon.hp > 0 && g.alive) {
      if (++guard > 200) break;
      // 中毒
      if (g.poison > 0) { g.hp = Math.max(0, g.hp - RNG.int(1, 2)); g.poison--; if (g.hp <= 0) { g.die(); break; } }
      // 玩家行动
      if (mon.boss && g.hp < g.maxHp * 0.22 && count(g, 'medkit') === 0) {
        // 危急且无药：逃
        const pr = Math.max(0.1, Math.min(0.92, BALANCE.fleeBase + g.dex * 0.04 - mon.tier * 0.05));
        g.spendStamina(5);
        if (RNG.chance(pr)) { return { fled: true }; }
      } else if (g.hp < g.maxHp * 0.32 && count(g, 'medkit') > 0) {
        g.useItem('medkit');
      } else {
        g.spendStamina(3);
        if (RNG.chance(playerHitChance(g, mon))) mon.hp -= playerDamage(g, mon);
      }
      if (mon.hp <= 0) break;
      // 怪物行动
      if (RNG.chance(monsterHitChance(g, mon))) {
        g.hp = Math.max(0, g.hp - monsterDamage(g, mon, defending));
        if (mon.poison && RNG.chance(0.7)) g.poison += RNG.int(2, 3);
        if (g.hp <= 0) { g.die(); }
      }
    }
    if (g.alive && mon.hp <= 0) { g.kills++; g.addXp(mon.xp); return { win: true }; }
    return { dead: !g.alive };
  }

  // 基地休整：吃饭→合成→睡觉
  function rest(g) {
    // 吃到不太饿
    let guard = 0;
    while (g.hunger > 35 && foodCount(g) > 0 && guard++ < 30) {
      if (count(g, 'meal')) g.useItem('meal');
      else if (count(g, 'ration')) g.useItem('ration');
      else g.useItem('water');
    }
    // 合成：撬棍、护盾、医疗包、热食
    const craftBy = (outId) => { const r = RECIPES.find(x => x.out[0] === outId); if (r && g.canCraft(r)) { g.int += 0; g.craft(r); } };
    if (!g.armorId && count(g, 'shield') === 0 && count(g, 'scrap') >= 4) craftBy('shield');
    if (count(g, 'pipe') === 0 && g.weaponId !== 'pipe' && count(g, 'scrap') >= 2) craftBy('pipe');
    while (count(g, 'medkit') < 3 && count(g, 'chem') >= 2) craftBy('medkit');
    while (count(g, 'ration') >= 1 && count(g, 'chem') >= 1 && count(g, 'meal') < 2) craftBy('meal');
    // 装备最佳武器/护盾
    const bw = bestWeaponInInv(g); if (bw !== g.weaponId) g.equip(bw);
    if (!g.armorId && count(g, 'shield') > 0) g.equip('shield');
    autoPerk(g);
    // 睡觉补体力（只有在有余粮、不会饿死时）
    if (g.stamina < g.maxStamina * 0.6 && (g.hunger < 70 || foodCount(g) > 0)) g.sleep();
  }

  function deathCause(g) {
    if (g.hunger >= 100) return 'starve';
    return 'combat'; // 其余多为战斗/精疲力竭致死
  }

  function runOne(cls) {
    const g = new GameState();
    g.initClass(cls);
    let guard = 0;
    while (g.alive && !g.won && guard++ < 3000) {
      // 休整判定
      if (g.stamina < BALANCE.descendStamina * 4 || g.hp < g.maxHp * 0.4) rest(g);
      if (!g.alive) break;
      // 下楼
      g.descend();
      if (g.won || !g.alive) break;
      // 里程碑 Boss
      const bossId = BOSS_FLOORS[g.descended];
      if (bossId && !g.bossesDone.includes(g.descended)) {
        const r = battle(g, bossId);
        if (g.alive && r.win) {
          g.bossesDone.push(g.descended);
          give(g, rollRare(4)); g.addItem(RNG.pick(['sword', 'axe', 'greatsword', 'hammer']), 1);
          autoPerk(g); const bw = bestWeaponInInv(g); if (bw !== g.weaponId) g.equip(bw);
        }
        continue;
      }
      // 生成并处理房间
      const type = RNG.weighted(roomWeightsFor(g.descended));
      if (type === 'monster') {
        const r = battle(g, RNG.pick(monsterPoolFor(g.descended)));
        if (g.alive && r.win) { give(g, rollLoot(RNG.int(1, 2))); autoPerk(g); }
        const bw = bestWeaponInInv(g); if (bw !== g.weaponId) g.equip(bw);
      } else if (type === 'loot') { g.spendStamina(BALANCE.searchStamina); give(g, rollLoot(RNG.int(2, 3))); }
      else if (type === 'empty') { g.spendStamina(BALANCE.searchStamina); if (RNG.chance(0.55)) give(g, rollLoot(1)); }
      else if (type === 'locked') { if (count(g, 'pipe') > 0 || g.weaponId === 'pipe') { g.spendStamina(6); give(g, rollRare(RNG.int(2, 3))); } }
      else if (type === 'special') {
        const sub = RNG.weighted({ rest: 4, cache: 4, trap: 3, trader: 3 });
        if (sub === 'rest') { g.hp = Math.min(g.maxHp, g.hp + Math.round(g.maxHp * 0.2)); g.stamina = Math.min(g.maxStamina, g.stamina + Math.round(g.maxStamina * 0.3)); }
        else if (sub === 'cache') give(g, rollRare(RNG.int(2, 4)));
        else if (sub === 'trader') { while (count(g, 'scrap') >= 3 && count(g, 'medkit') < 3) { g.removeItem('scrap', 3); g.addItem('medkit', 1); } if (!g.armorId && count(g, 'shield') === 0 && count(g, 'scrap') >= 5) { g.removeItem('scrap', 5); g.addItem('shield', 1); g.equip('shield'); } }
        else { g.hp = Math.max(0, g.hp - RNG.int(6, 14)); g.stamina = Math.max(0, g.stamina - 8); if (g.hp <= 0) g.die(); }
      }
    }
    return { won: g.won, floor: g.floor, descended: g.descended, day: g.day, kills: g.kills, cause: g.won ? 'win' : deathCause(g) };
  }

  const out = {};
  for (const cls of CLASSES) {
    const runs = [];
    for (let i = 0; i < N; i++) runs.push(runOne(cls));
    const wins = runs.filter(r => r.won).length;
    const causes = {};
    for (const r of runs) causes[r.cause] = (causes[r.cause] || 0) + 1;
    out[cls.name] = {
      winRate: +(wins / N * 100).toFixed(1),
      avgDescended: +(runs.reduce((a, r) => a + r.descended, 0) / N).toFixed(1),
      medianFloor: runs.map(r => r.floor).sort((a, b) => a - b)[Math.floor(N / 2)],
      avgDay: +(runs.reduce((a, r) => a + r.day, 0) / N).toFixed(1),
      causes,
    };
  }
  return out;
}, N);

console.log(`=== 平衡模拟（每职业 ${N} 局）===`);
for (const [name, r] of Object.entries(report)) {
  console.log(`\n【${name}】 胜率 ${r.winRate}%  平均下降 ${r.avgDescended} 层  中位到达 ${r.medianFloor} 层  平均 ${r.avgDay} 天`);
  console.log('  死因/结果:', JSON.stringify(r.causes));
}
await b.close();
