#!/usr/bin/env node
/**
 * preview_index.js —— 把首页 WXML/WXSS 渲染成 375×812 的预览图（开发自检用，不进小程序包）
 *
 * 为什么需要：本机没有微信开发者工具，改版式之后无处可看。
 * 这个脚本把 index.wxss 的 rpx 按 375 宽换算成 px（1rpx = 0.5px），
 * 用 content.js 的真实数据拼出首页，再截两张图：
 *   _preview/index_collapsed.png  收起态（下拉未展开）
 *   _preview/index_open.png       展开态（模拟微信 selector 弹层，确认 12 册一眼看全）
 *
 * 注意：这是版式参考，不是像素级一致 —— picker 弹层是微信原生组件，
 * 浏览器里没有，这里用样式近似模拟，只用来判断「能不能看全 / 会不会挤」。
 *
 * 用法：node tools/preview_index.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');
const OUT = path.join(ROOT, '_preview');
const { chromium } = require(path.join('F:/Obsidian/vault/HBS/starry-night-3d/node_modules/playwright-core'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

/* rpx → px：微信 750rpx = 屏幕宽，预览按 375px 宽 ⇒ 1rpx = 0.5px */
function rpx2px(css) {
  return css.replace(/(-?\d*\.?\d+)rpx/g, (_, n) => `${(parseFloat(n) * 0.5).toFixed(1)}px`);
}

const wxss = rpx2px(fs.readFileSync(path.join(MP, 'pages/index/index.wxss'), 'utf8'));
const appWxss = fs.existsSync(path.join(MP, 'app.wxss'))
  ? rpx2px(fs.readFileSync(path.join(MP, 'app.wxss'), 'utf8'))
  : '';

const content = require(path.join(MP, 'data/content.js'));
const bookLabels = content.books.map((b) => `${b.title} · ${b.nodeCount} 讲`);

/* 取一个有代表性的册：二年级下册（39 讲，11 单元），和用户截图同一册便于对比 */
const KEY = 'g2x';
const list = content.nodes.filter((n) => n.book === KEY);
const qTotal = list.reduce((s, n) => s + n.questions.length, 0);
const map = new Map();
list.forEach((n) => {
  if (!map.has(n.unit)) map.set(n.unit, { unit: n.unit, seq: n.unitSeq, nodes: [] });
  map.get(n.unit).nodes.push({ order: n.order, title: n.title, qCount: n.questions.length });
});
const groups = [...map.values()].sort((a, b) => a.seq - b.seq);

// 与 index.js 的 unitShort 同规则：有编号取序号，特殊单元缩两字
const SPECIAL_SHORT = { 综合实践: '综合', 数学好玩: '好玩', 总复习: '复习' };
const unitShort = (unit) => {
  const str = String(unit || '');
  const m = /^第([一二三四五六七八九十]+)单元/.exec(str);
  if (m) return m[1];
  const head = str.split(/\s+/)[0];
  return SPECIAL_SHORT[head] || head;
};

const unitChips = (() => {
  const list = groups.map((g) => unitShort(g.unit));
  const cnt = {};
  list.forEach((s) => { cnt[s] = (cnt[s] || 0) + 1; });
  const seen = {};
  return list.map((s, i) => {
    let label = s;
    if (cnt[s] > 1) { seen[s] = (seen[s] || 0) + 1; label = s + seen[s]; }
    return `\n    <view class="unit-chip ${i === 0 ? 'on' : ''}">${label}</view>`;
  }).join('');
})();

// 假状态：前两节「讲过」、第三节「练过」，用来确认三态圆点和「已讲 x/y」的观感。
// 分数按新口径只给机器判分题（4 题里 1 道解答题自评，所以是 3/3 而不是 3/4）。
// 预览是静态页，没有真实 storage，所以在这里造。
let fakeIdx = 0;
const nodeCards = groups.slice(0, 3).map((g) => {
  const nodes = g.nodes.map((n) => {
    const state = fakeIdx === 2 ? 'done' : (fakeIdx < 2 ? 'taught' : '');
    fakeIdx += 1;
    return Object.assign({}, n, { state });
  });
  // 只数「讲过」：练过不算已讲，跟 index.js 的 taughtCount 口径一致
  const taughtN = nodes.filter((n) => n.state === 'taught').length;
  const countText = taughtN > 0 ? `已讲 ${taughtN}/${nodes.length}` : `${nodes.length} 讲`;
  return `
  <view class="unit-head">
    <text class="unit-name">${g.unit}</text>
    <text class="unit-count ${taughtN === nodes.length ? 'all' : ''}">${countText}</text>
  </view>
  ${nodes.map((n) => `
  <view class="card node">
    <view class="node-main">
      <view class="node-title">
        <text class="node-dot ${n.state}"></text>
        <text class="node-text">${n.order}. ${n.title}</text>
      </view>
      <view class="muted">${n.qCount} 道练习${
        n.state === 'done' ? ' <text class="done">· 上次 3/3</text>'
          : (n.state === 'taught' ? ' <text class="seen">· 已讲</text>' : '')
      }</view>
    </view>
    <view class="node-btns">
      <view class="mini-btn ghost">讲解</view>
      <view class="mini-btn">练习</view>
    </view>
  </view>`).join('')}
`;
}).join('');

/* 「继续上次」横条：取整册第 3 节当演示 */
const ordered = list.slice().sort((a, b) => a.order - b.order);
const resumeNode = ordered[2] || ordered[0];
const resumeBar = `
      <view class="resume">
        <view class="resume-main">
          <text class="resume-label">上次讲到</text>
          <text class="resume-title">${resumeNode.title}</text>
        </view>
        <view class="resume-side">
          <text class="resume-pos">第 ${3}/${ordered.length} 节</text>
          <text class="resume-go">继续 ›</text>
        </view>
      </view>`;

/* 两列弹层：年级 / 上下册。用来确认「6+2 项是否全在一屏内、不用滚」 */
const GRADE_CN = ['一', '二', '三', '四', '五', '六'];
const grades = [...new Set(content.books.map((b) => b.grade))].sort((a, b) => a - b);
const curBook = content.books.find((b) => b.key === KEY);
const gi = grades.indexOf(curBook.grade);
const ti = curBook.term === '下' ? 1 : 0;

const pickerOpen = `
  <div class="picker-sheet">
    <div class="picker-sheet-title">选择册次</div>
    <div class="picker-cols">
      <div class="picker-col" id="col-grade">
        ${grades.map((g, i) => `
        <div class="picker-item ${i === gi ? 'on' : ''}">
          <span>${GRADE_CN[g - 1]}年级</span>
        </div>`).join('')}
      </div>
      <div class="picker-col" id="col-term">
        ${['上册', '下册'].map((t, i) => `
        <div class="picker-item ${i === ti ? 'on' : ''}"><span>${t}</span></div>`).join('')}
      </div>
    </div>
    <div class="picker-sheet-cancel">取消</div>
  </div>`;

/* 预览专用补丁样式：一律写 rpx，跟 wxss 同一换算，避免硬写 px 把版式放大走样 */
const DEMO_CSS = rpx2px(`
  view { display: block; }
  .card { background: #fff; border-radius: 16rpx; }
  .muted { font-size: 24rpx; color: #999; }
  .node-btns { display: flex; gap: 16rpx; }
  .mini-btn { font-size: 26rpx; padding: 10rpx 26rpx; border-radius: 999rpx; background: #07c160; color: #fff; }
  .mini-btn.ghost { background: #fff; color: #07c160; border: 1rpx solid #07c160; }
  /* 微信 multiSelector 弹层近似样式（仅预览用） */
  .picker-sheet { position: absolute; left: 0; right: 0; bottom: 0; background: #fff; border-radius: 16rpx 16rpx 0 0; box-shadow: 0 -8rpx 24rpx rgba(0,0,0,.12); }
  .picker-sheet-title { text-align: center; font-size: 26rpx; color: #999; padding: 20rpx; border-bottom: 1rpx solid #eee; }
  .picker-cols { display: flex; }
  .picker-col { flex: 1; padding: 12rpx 0; }
  .picker-col:first-child { border-right: 1rpx solid #f0f0f0; }
  .picker-item { display: flex; align-items: center; justify-content: center; height: 84rpx; font-size: 30rpx; color: #333; }
  .picker-item.on { color: #07c160; font-weight: 600; background: #f2fbf6; }
  .picker-sheet-cancel { text-align: center; padding: 26rpx; font-size: 30rpx; color: #666; border-top: 16rpx solid #f2f4f3; }
  .mask { position: absolute; inset: 0; background: rgba(0,0,0,.35); }
  /* scroll-view 是自定义标签，浏览器里默认 inline，不处理会挤成一行断行 */
  scroll-view { display: block; overflow-x: auto; overflow-y: hidden; }
`);

function html(withSheet) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 375px; background: #f2f4f3; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
  ${appWxss}
  ${wxss}
  ${DEMO_CSS}
  </style></head><body>
  <div style="position:relative;height:812px;overflow:hidden;background:#f2f4f3;">
    <view class="page">
      <view class="book-bar">
        <view class="book-picker"><view class="picker-box">
          <text class="picker-text">${bookLabels[content.books.findIndex((b) => b.key === KEY)]}</text>
          <text class="picker-arrow">▾</text>
        </view></view>
        <text class="cloud-tag">本机运行</text>
      </view>
      ${resumeBar}
      <view class="summary"><text>共 ${list.length} 个知识点 · ${qTotal} 道练习</text></view>
      <view class="unit-bar">${unitChips}</view>
      ${nodeCards}
    </view>
    ${withSheet ? '<div class="mask"></div>' + pickerOpen : ''}
  </div></body></html>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EDGE });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });

  for (const [name, sheet] of [['index_collapsed', false], ['index_open', true]]) {
    const f = path.join(OUT, `${name}.html`);
    fs.writeFileSync(f, html(sheet), 'utf8');
    await page.goto('file:///' + f.replace(/\\/g, '/'));
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log('  ' + path.join(OUT, `${name}.png`));
  }

  // 断言：下拉框文字没被截断；两列项数 6/2 且整层能在一屏内放下（不用滚）
  const info = await page.evaluate(() => {
    const t = document.querySelector('.picker-text');
    // 圆点也带 .done，必须限定到分数文字，否则 querySelector 会拿到空圆点
    const done = document.querySelector('.muted .done');
    const cols = [...document.querySelectorAll('.picker-col')];
    const sheet = document.querySelector('.picker-sheet');
    return {
      textClipped: t.scrollWidth > t.clientWidth + 1,
      colItems: cols.map((c) => c.querySelectorAll('.picker-item').length),
      sheetScrolls: sheet ? sheet.scrollHeight > sheet.clientHeight + 1 : false,
      sheetTop: sheet ? Math.round(sheet.getBoundingClientRect().top) : null,
      inViewport: sheet ? sheet.getBoundingClientRect().bottom <= 813 : false,
      doneText: done ? done.textContent.trim() : ''
    };
  });
  console.log(`\n下拉文字截断：${info.textClipped ? '是（需缩短文案）' : '否'}`);
  console.log(`两列项数：年级 ${info.colItems[0]} / 册次 ${info.colItems[1]}`);
  console.log(`弹层顶边 y=${info.sheetTop}，内部滚动：${info.sheetScrolls ? '需要' : '不需要'}，完整在屏内：${info.inViewport ? '是' : '否'}`);
  console.log(`练过卡片分数：${info.doneText}（只算机器判分题）`);

  // 单元索引条：所有单元必须一屏排得下（折行，不横滑）
  const bar = await page.evaluate(() => {
    const bar = document.querySelector('.unit-bar');
    const chips = [...document.querySelectorAll('.unit-chip')];
    const tops = chips.map((c) => Math.round(c.getBoundingClientRect().top));
    const rows = new Set(tops).size;
    const overflow = chips.filter((c) => c.getBoundingClientRect().right > 375.5).length;
    return {
      count: chips.length,
      rows,
      height: Math.round(bar.getBoundingClientRect().height),
      overflow
    };
  });
  console.log(`单元索引：${bar.count} 个单元排成 ${bar.rows} 行，条高 ${bar.height}px，右边界溢出 ${bar.overflow} 个`);

  await browser.close();
  const bad = info.textClipped || info.colItems[0] !== grades.length || info.colItems[1] !== 2 || info.sheetScrolls || !info.inViewport
    || info.doneText !== '· 上次 3/3'
    || bar.overflow > 0 || bar.rows > 3 || bar.height > 120;
  process.exit(bad ? 1 : 0);
})();
