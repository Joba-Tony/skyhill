// 逻辑测试：在浏览器内直接驱动 GameState，校验合成/用药/下楼/通关等数值逻辑。
// 用法：先起 http.server 8080，再 node tests/logic.mjs
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
const fails = [];
p.on('pageerror', e => fails.push('PAGEERR ' + e.message));
await p.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 800));

const result = await p.evaluate(async () => {
  const { game } = window.__SKYHILL__;
  const out = [];
  const ok = (c, m) => out.push([!!c, m]);

  // --- 重置为工程师 ---
  game.reset();
  game.initClass({ id: 'engineer', name: '工程师', frame: 100, weapon: 'dagger',
    stats: { maxHp: 90, maxStamina: 90, str: 4, acc: 6, dex: 5, int: 9 },
    items: [['scrap', 5], ['chem', 3], ['ration', 1]] });
  ok(game.countItem('scrap') === 5, '初始废铁=5');
  ok(game.weaponId === 'dagger', '初始武器=匕首');

  // --- 合成：铁管(废铁×2) ---
  game.int = 50; // 提高成功率确保成功
  const pipe = game.recipesFor('workbench').find(r => r.out[0] === 'pipe');
  const before = game.countItem('scrap');
  const res = game.craft(pipe);
  ok(res && res.ok, '合成铁管成功');
  ok(game.countItem('scrap') === before - 2, '合成消耗废铁×2');
  ok(game.countItem('pipe') === 1, '获得铁管×1');

  // --- 装备铁管 ---
  game.equip('pipe');
  ok(game.weaponId === 'pipe', '装备铁管');
  ok(game.countItem('dagger') === 1, '原匕首退回背包');

  // --- 用药：医疗包回血 ---
  game.addItem('medkit', 1);
  game.hp = 10;
  const r2 = game.useItem('medkit');
  ok(r2 && game.hp > 10, '医疗包回血');
  ok(game.countItem('medkit') === 0, '医疗包已消耗');

  // --- 下楼推进 ---
  const f0 = game.floor, d0 = game.descended;
  game.descend();
  ok(game.floor === f0 - 1, '下楼层数 -1');
  ok(game.descended === d0 + 1, '已下降 +1');
  ok(game.hunger > 0, '下楼增加饥饿');

  // --- 通关判定：到 1 层 ---
  game.floor = 2;
  game.descend();
  ok(game.won === true, '抵达1层判定通关');

  // --- 饥饿满值掉血 ---
  game.won = false; game.hunger = 100; const hp1 = game.hp;
  game.advance(0);
  ok(game.hp < hp1, '饥饿满值持续掉血');

  // --- 背包格子上限 ---
  game.inv = []; let added = 0;
  const ids = ['scrap','chem','ration','water','medkit','energy','dagger','knife','club','pipe','sword','axe','greatsword','hammer','shield','meal'];
  for (const id of ids) if (game.addItem(id, 1)) added++;
  const overflow = game.addItem('fist'); // 第17种应失败(上限16)
  ok(added === 16, `背包装入16种 (实际${added})`);
  ok(overflow === false, '超过格子上限拒绝拾取');

  return out;
});

console.log('=== 逻辑测试 ===');
let bad = 0;
for (const [pass, msg] of result) { console.log(`  ${pass ? '✓' : '✗'} ${msg}`); if (!pass) bad++; }
if (fails.length) console.log(fails.join('\n'));
await b.close();
const total = bad + fails.length;
console.log(total ? `\n${total} 项失败` : '\n全部通过');
process.exit(total ? 1 : 0);
