// 冒烟/回归：加载 → 主菜单 → 开始 → 移动/自动战斗 → 升级三选一 → 截图，捕获错误。
// 用法：先 `python3 serve.py 8080`，再 `node tests/smoke.mjs`
import { chromium } from 'playwright-core';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
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
const scenes = () => page.evaluate(() => window.__MW__.game.scene.getScenes(true).map(s => s.scene.key));
const gstate = () => page.evaluate(() => { const g = window.__MW__.game.scene.getScene('Game'); if (!g || !g.player) return null; return { hp: Math.ceil(g.player.hp), lvl: g.level, kills: g.kills, enemies: g.enemies.length, gems: g.gems.length, bullets: g.bullets.length, t: +g.elapsed.toFixed(1), over: g.over, weapons: Object.keys(g.weapons) }; });
const findBtn = (sub) => page.evaluate((s) => {
  const g = window.__MW__.game;
  for (const sc of g.scene.getScenes(true)) { const st = [...sc.children.list]; while (st.length) { const o = st.pop(); if (o.list) st.push(...o.list); if (o.input && o.input.enabled) { const t = (o.list || []).filter(c => c.type === 'Text'); if (t.some(x => (x.text || '').includes(s))) { const m = o.getWorldTransformMatrix(); return { x: m.tx, y: m.ty }; } } } }
  return null;
}, sub);
async function tap(sub) { const b = await findBtn(sub); if (!b) return false; await clickGame(b.x, b.y); return true; }
function assert(c, m) { if (!c) { errors.push('ASSERT ' + m); console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); }

await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await sleep(900);

assert((await scenes()).includes('Menu'), '主菜单加载');
await page.screenshot({ path: `${OUT}/mw_1_menu.png` });

assert(await tap('开始'), '点击 开始游戏'); await sleep(800);
assert((await scenes()).includes('Game'), '进入 游戏');

// 自动游玩：来回移动收集经验、自动武器清怪
let maxKills = 0, maxLvl = 1, sawUpgrade = false, gameShot = false, upgradeShot = false;
const dirs = [['ArrowRight', 'ArrowDown'], ['ArrowLeft', 'ArrowUp'], ['ArrowRight', 'ArrowUp'], ['ArrowLeft', 'ArrowDown']];
for (let i = 0; i < 40; i++) {
  const sc = await scenes();
  if (sc.includes('GameOver')) break;
  if (sc.includes('Upgrade')) {
    sawUpgrade = true;
    if (!upgradeShot) { await page.screenshot({ path: `${OUT}/mw_3_upgrade.png` }); upgradeShot = true; }
    await page.keyboard.press('Digit1'); await sleep(250); continue;
  }
  const gs = await gstate();
  if (gs) { maxKills = Math.max(maxKills, gs.kills); maxLvl = Math.max(maxLvl, gs.lvl); if (!gameShot && gs.enemies > 8) { await page.screenshot({ path: `${OUT}/mw_2_game.png` }); gameShot = true; } }
  const [k1, k2] = dirs[i % dirs.length];
  await page.keyboard.down(k1); await page.keyboard.down(k2); await sleep(380); await page.keyboard.up(k1); await page.keyboard.up(k2);
}

if (!gameShot) await page.screenshot({ path: `${OUT}/mw_2_game.png` });
const gs = await gstate();
await page.screenshot({ path: `${OUT}/mw_4_final.png` });
console.log('\n=== 游玩结果 ===');
console.log(JSON.stringify(gs) + `  maxKills=${maxKills} maxLvl=${maxLvl} sawUpgrade=${sawUpgrade}`);
assert(maxKills > 0, '自动武器击杀了敌人');
assert(maxLvl >= 1, '游戏运行正常');

console.log('\n=== 错误 ===');
console.log(errors.length ? errors.join('\n') : '(无)');
await b.close();
process.exit(errors.length ? 1 : 0);
