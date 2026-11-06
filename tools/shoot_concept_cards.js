// tools/shoot_concept_cards.js —— 概念卡排版抽查（无头浏览器截图）
//
// 为什么要抽查：428 张概念卡的文本长度各不相同（要点 8~19 字、易错 6~18 字），
// 排版按比例布局，只有在「最长的那个」上才可能压边/重叠。所以不能只测一张。
// 这里按要点长度排序，取最长/最短/各年级代表，渲染到最后一帧并拼成一张图。
//
// 运行：node tools/shoot_concept_cards.js
// 产出：_shots/concept_montage.png

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');
const { nodes } = require(path.join(MP, 'data/content.js'));
const { resolveAnim } = require(path.join(MP, 'utils/anim/map.js'));
const { genNarration } = require(path.join(MP, 'utils/anim/narration_kp.js'));

// 概念卡节点 + 计算出的 data/narration
const cards = [];
nodes.forEach((n) => {
  const r = resolveAnim(n);
  if (!r || r.scene !== 'conceptCard') return;
  const nar = genNarration(r.scene, r.data, n);
  cards.push({
    id: n.id,
    book: n.book,
    title: n.title,
    data: r.data,
    narration: { total: nar.total, lines: nar.lines },
    relLen: (r.data.relation || '').length,
    tipLen: (r.data.tip || '').length
  });
});

// 取样本：要点最长的 2 个、最短的 2 个、易错最长的 1 个，再按册补齐
const sample = [];
const push = (c) => { if (c && sample.indexOf(c) < 0 && sample.length < 8) sample.push(c); };
cards.slice().sort((a, b) => b.relLen - a.relLen).slice(0, 2).forEach(push);
cards.slice().sort((a, b) => a.relLen - b.relLen).slice(0, 2).forEach(push);
cards.slice().sort((a, b) => b.tipLen - a.tipLen).slice(0, 2).forEach(push);
['g2s', 'g4s', 'g6s'].forEach((b) => push(cards.find((c) => c.book === b)));

console.log(`概念卡 ${cards.length} 张，抽查 ${sample.length} 张：`);
sample.forEach((c) => console.log(`  ${c.id} [${c.book}] 要点${c.relLen}字 易错${c.tipLen}字  ${c.title}`));

const { chromium } = require('F:/Obsidian/vault/HBS/starry-night-3d/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE });
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file:///' + path.join(ROOT, '_preview', 'anim_demo.html').replace(/\\/g, '/'));
  await page.waitForTimeout(400);

  const shots = [];
  for (const c of sample) {
    const png = await page.evaluate((card) => {
      const okDraw = window.__drawWith('conceptCard', card.data, card.narration.total * 0.97, card.narration);
      if (!okDraw) return null;
      const cv = document.getElementById('cv');
      return cv.toDataURL('image/png');
    }, c);
    if (png) shots.push({ id: c.id, png: png });
  }

  // 拼成一张（3 列），方便一眼看完
  const montage = await page.evaluate(async (list) => {
    const imgs = await Promise.all(list.map((s) => new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.src = s.png;
    })));
    const cols = 3;
    const w = imgs[0].width, h = imgs[0].height;
    const rows = Math.ceil(imgs.length / cols);
    const cv = document.createElement('canvas');
    cv.width = w * cols; cv.height = h * rows + 26 * rows;
    const x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
    imgs.forEach((im, i) => {
      const cx = (i % cols) * w, cy = Math.floor(i / cols) * (h + 26);
      x.drawImage(im, cx, cy + 24);
      x.fillStyle = '#333'; x.font = '16px sans-serif';
      x.fillText(list[i].id, cx + 10, cy + 17);
    });
    return cv.toDataURL('image/png');
  }, shots.map((s) => ({ id: s.id, png: s.png })));

  const outDir = path.join(ROOT, '_shots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'concept_montage.png');
  fs.writeFileSync(out, Buffer.from(montage.split(',')[1], 'base64'));
  console.log(`\n${shots.length} 张 → ${path.relative(ROOT, out)}`);
  if (errs.length) console.log('页面报错：', errs.slice(0, 3));

  await browser.close();
})();
