// 冒烟/回归测试：菜单流程 + 横版 Field 自动游玩（走动/攻击/下楼），捕获错误并截图。
// 用法：先 `python3 -m http.server 8080`，再 `node tests/smoke.mjs`
import { chromium } from 'playwright-core';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = 'http://localhost:8080/index.html';
const OUT = process.env.SHOT_DIR || '/tmp/claude-0/-home-user-skyhill/c7ed4542-1cbd-561f-9aea-6e7090aa5f87/scratchpad';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 960, height: 600 } });
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
page.on('pageerror', e => errors.push('PAGEERR ' + e.message));

async function clickGame(gx, gy) {
  const box = await page.locator('#game canvas').boundingBox();
  const s = Math.min(box.width / 960, box.height / 600);
  await page.mouse.click(box.x + (box.width - 960 * s) / 2 + gx * s, box.y + (box.height - 600 * s) / 2 + gy * s);
}
const scenes = () => page.evaluate(() => window.__SKYHILL__.phaserGame.scene.getScenes(true).map(s => s.scene.key));
const gstate = () => page.evaluate(() => { const g = window.__SKYHILL__.game; return { hp: g.hp, floor: g.floor, descended: g.descended, alive: g.alive, won: g.won, kills: g.kills, level: g.level }; });
const fieldState = () => page.evaluate(() => { const f = window.__SKYHILL__.phaserGame.scene.getScene('Field'); if (!f || !f.hero) return null; return { x: Math.round(f.hero.x), mons: f.monsters.filter(m => !m.dead).map(m => Math.round(m.x)) }; });
const findBtn = (sub) => page.evaluate((s) => {
  const g = window.__SKYHILL__.phaserGame;
  for (const sc of g.scene.getScenes(true)) { const st = [...sc.children.list]; while (st.length) { const o = st.pop(); if (o.list) st.push(...o.list); if (o.input && o.input.enabled) { const t = (o.list || []).filter(c => c.type === 'Text'); if (t.some(x => (x.text || '').includes(s))) { const m = o.getWorldTransformMatrix(); return { x: m.tx, y: m.ty }; } } } }
  return null;
}, sub);
async function tap(sub) { const b = await findBtn(sub); if (!b) return false; await clickGame(b.x, b.y); return true; }
function assert(c, m) { if (!c) { errors.push('ASSERT ' + m); console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); }

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await sleep(1000);

assert((await scenes()).includes('Menu'), '主菜单加载');
await page.screenshot({ path: `${OUT}/shot_1_menu.png` });
assert(await tap('新 游 戏'), '点击 新游戏'); await sleep(600);
assert((await scenes()).includes('ClassSelect'), '进入 选职业');
await page.screenshot({ path: `${OUT}/shot_2_class.png` });
const cs = (await page.evaluate(() => { const g = window.__SKYHILL__.phaserGame; const out = []; const sc = g.scene.getScene('ClassSelect'); const st = [...sc.children.list]; while (st.length) { const o = st.pop(); if (o.list) st.push(...o.list); if (o.input && o.input.enabled) { const t = (o.list || []).filter(c => c.type === 'Text'); if (t.some(x => (x.text || '').includes('选 择'))) { const m = o.getWorldTransformMatrix(); out.push({ x: m.tx, y: m.ty }); } } } return out; })).sort((a, b) => a.x - b.x);
await clickGame(cs[0].x, cs[0].y); await sleep(600);
assert((await scenes()).includes('Base'), '进入 基地');
await page.screenshot({ path: `${OUT}/shot_3_base.png` });

// 基地子界面
assert(await tap('工作台'), '打开 工作台'); await sleep(400);
assert((await scenes()).includes('Craft'), '合成界面'); await tap('关闭'); await sleep(300);
assert(await tap('下楼探索'), '下楼探索'); await sleep(700);
assert((await scenes()).includes('Field'), '进入 横版 Field');
await page.screenshot({ path: `${OUT}/shot_4_field.png` });

// 自动游玩横版：靠近怪就打，否则向右走，到门口下楼
let combatShot = false, sawCombat = false;
for (let i = 0; i < 90; i++) {
  const sc = await scenes();
  if (sc.includes('GameOver')) break;
  if (sc.includes('LevelUp')) { await (tap('力量') || tap('生命')); await sleep(200); continue; }
  if (sc.includes('Inventory') || sc.includes('Craft') || sc.includes('Shop')) { await tap('关闭'); await sleep(250); continue; }
  if (!sc.includes('Field')) { await sleep(150); continue; }
  const fs = await fieldState();
  if (!fs) { await sleep(150); continue; }
  const near = fs.mons.find(mx => Math.abs(mx - fs.x) < 110);
  if (near !== undefined) {
    sawCombat = true;
    if (!combatShot && i > 1) { await page.screenshot({ path: `${OUT}/shot_5_combat.png` }); combatShot = true; }
    // 面向怪
    await page.keyboard.down(near > fs.x ? 'ArrowRight' : 'ArrowLeft'); await sleep(60); await page.keyboard.up(near > fs.x ? 'ArrowRight' : 'ArrowLeft');
    await page.keyboard.press('KeyJ'); await sleep(220);
  } else if (fs.x > 850) {
    await page.keyboard.press('KeyE'); await sleep(500); // 下楼
  } else {
    await page.keyboard.down('ArrowRight'); await sleep(420); await page.keyboard.up('ArrowRight');
  }
}

const gs = await gstate();
await page.screenshot({ path: `${OUT}/shot_6_final.png` });
console.log('\n=== 游玩结果 ===');
console.log(JSON.stringify(gs));
assert(sawCombat, '触发横版战斗');
assert(gs.descended > 1, '成功向下推进');

console.log('\n=== 错误 ===');
console.log(errors.length ? errors.join('\n') : '(无)');
await b.close();
process.exit(errors.length ? 1 : 0);
