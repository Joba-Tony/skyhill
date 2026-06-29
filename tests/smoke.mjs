// 冒烟/回归测试：按钮文字定位 + 场景断言，自动玩一整局，捕获错误并截图。
// 用法：先 `python3 -m http.server 8080`，再 `node tests/smoke.mjs`
import { chromium } from 'playwright-core';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = 'http://localhost:8080/index.html';
const OUT = process.env.SHOT_DIR || '/tmp/claude-0/-home-user-skyhill/c7ed4542-1cbd-561f-9aea-6e7090aa5f87/scratchpad';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 960, height: 600 } });
page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
page.on('pageerror', e => errors.push('PAGEERR ' + e.message));

async function clickGame(gx, gy) {
  const box = await page.locator('#game canvas').boundingBox();
  const s = Math.min(box.width / 960, box.height / 600);
  await page.mouse.click(box.x + (box.width - 960 * s) / 2 + gx * s, box.y + (box.height - 600 * s) / 2 + gy * s);
}
const scenes = () => page.evaluate(() => window.__SKYHILL__.phaserGame.scene.getScenes(true).map(s => s.scene.key));
const gstate = () => page.evaluate(() => { const g = window.__SKYHILL__.game; return { cls: g.className, hp: g.hp, floor: g.floor, descended: g.descended, alive: g.alive, won: g.won, kills: g.kills, inv: g.inv.length }; });
// 找到文字包含 substr 的可交互按钮的世界坐标
const findBtn = (substr) => page.evaluate((sub) => {
  const g = window.__SKYHILL__.phaserGame;
  for (const sc of g.scene.getScenes(true)) {
    const stack = [...sc.children.list];
    while (stack.length) {
      const o = stack.pop();
      if (o.list) stack.push(...o.list);
      if (o.input && o.input.enabled) {
        const texts = (o.list || []).filter(c => c.type === 'Text');
        if (texts.some(t => (t.text || '').includes(sub))) {
          const m = o.getWorldTransformMatrix();
          return { x: m.tx, y: m.ty };
        }
      }
    }
  }
  return null;
}, substr);
async function tap(substr) { const b = await findBtn(substr); if (!b) return false; await clickGame(b.x, b.y); return true; }
function assert(c, m) { if (!c) { errors.push('ASSERT ' + m); console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); }

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await sleep(1000);

assert((await scenes()).includes('Menu'), '主菜单加载');
await page.screenshot({ path: `${OUT}/shot_1_menu.png` });

assert(await tap('新 游 戏') || await tap('新游戏'), '点击 新游戏');
await sleep(700);
assert((await scenes()).includes('ClassSelect'), '进入 选职业');
await page.screenshot({ path: `${OUT}/shot_2_class.png` });

assert(await tap('选 择') || await tap('选择'), '点击 选择(保安)');
await sleep(700);
assert((await scenes()).includes('Base'), '进入 基地');
await page.screenshot({ path: `${OUT}/shot_3_base.png` });

// 基地子界面测试
assert(await tap('工作台'), '打开 工作台');
await sleep(500); assert((await scenes()).includes('Craft'), '合成界面出现');
await page.screenshot({ path: `${OUT}/shot_3b_craft.png` });
assert(await tap('关闭'), '关闭 合成'); await sleep(400);
assert(await tap('背包'), '打开 背包'); await sleep(400);
assert((await scenes()).includes('Inventory'), '背包界面出现');
await page.screenshot({ path: `${OUT}/shot_3c_inv.png` });
assert(await tap('关闭'), '关闭 背包'); await sleep(400);

assert(await tap('下楼探索'), '点击 下楼探索'); await sleep(700);
assert((await scenes()).includes('Explore'), '进入 探索');
await page.screenshot({ path: `${OUT}/shot_4_explore.png` });

// 自动游玩
let combatShot = false, sawCombat = false, iter = 0;
for (iter = 0; iter < 120; iter++) {
  const sc = await scenes();
  const top = sc[sc.length - 1];
  if (sc.includes('GameOver')) { break; }
  if (sc.includes('Combat')) {
    sawCombat = true;
    if (!combatShot) { await page.screenshot({ path: `${OUT}/shot_5_combat.png` }); combatShot = true; }
    if (!(await tap('继续'))) { await tap('⚔ 攻击') || await tap('攻击'); }
    await sleep(450);
    continue;
  }
  if (sc.includes('LevelUp')) { (await tap('力量') || await tap('命中') || await tap('生命')); await sleep(250); continue; }
  if (sc.includes('Inventory') || sc.includes('Craft') || sc.includes('Shop')) { await tap('关闭'); await sleep(300); continue; }
  if (top === 'Explore') {
    if (await tap('战斗')) { await sleep(500); continue; }
    // 优先解锁/搜刮/特殊，再下楼
    if (await tap('撬锁') || await tap('搜刮') || await tap('搜索') || await tap('打开') || await tap('休息')) { await sleep(350); }
    await tap('继续下楼'); await sleep(450); continue;
  }
  if (top === 'Base') { await tap('下楼探索'); await sleep(450); continue; }
  await sleep(300);
}

const gs = await gstate();
await page.screenshot({ path: `${OUT}/shot_6_final.png` });
console.log('\n=== 游玩结果 ===');
console.log(JSON.stringify(gs));
console.log('迭代:', iter, '遇到战斗:', sawCombat);
assert(sawCombat, '至少触发一次战斗');
assert(gs.descended > 0, '成功向下推进');

console.log('\n=== 错误 ===');
console.log(errors.length ? errors.join('\n') : '(无)');
await b.close();
process.exit(errors.length ? 1 : 0);
