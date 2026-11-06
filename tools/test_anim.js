#!/usr/bin/env node
/**
 * test_anim.js —— 在 Node 里把每个动画场景从头到尾逐帧扫一遍（不需要浏览器）
 *
 * 为什么需要：浏览器截图能看出「这一帧长得对不对」，但看不了每一帧；
 * 而动画最常见的崩法恰恰是某一帧的参数算错了 —— 坐标变成 NaN，canvas 静默不画，
 * 表现就是「动画放到第 5 秒突然空了一下」，肉眼很难复现。
 *
 * 这里用一个假的 ctx（记录每次调用），对每个场景按 0.05 秒步长跑完整条时间轴，断言：
 *   1. 所有数值参数都是有限数（抓 NaN / Infinity）
 *   2. 文字都在画布内（抓「标注被右边缘裁掉」这类问题，fractionAdd 第一版就裁过）
 *   3. 每帧笔画调用数不为 0（抓「整帧空白」）
 *
 * 用法：node tools/test_anim.js
 */
const path = require('path');

const MP = path.join(__dirname, '..', 'miniprogram');
const engine = require(path.join(MP, 'utils', 'anim', 'engine.js'));
const { MAP } = require(path.join(MP, 'utils', 'anim', 'map.js'));

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

/* 粗略估宽：中文按 1em，西文数字按 0.55em。宁可估宽一点，用来抓越界 */
function estWidth(text, fontSize) {
  let w = 0;
  for (const ch of String(text)) {
    w += /[\u4e00-\u9fa5]/.test(ch) ? fontSize : fontSize * 0.55;
  }
  return w;
}

function makeCtx(W, H, frameTag) {
  const state = { font: '16px sans-serif', textAlign: 'center', textBaseline: 'middle', globalAlpha: 1 };
  const stats = { ops: 0, texts: [] };
  const noop = () => { stats.ops++; };

  const ctx = {
    // 状态属性
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v) { state.fillStyle = v; },
    get strokeStyle() { return state.strokeStyle; },
    set strokeStyle(v) { state.strokeStyle = v; },
    get lineWidth() { return state.lineWidth; },
    set lineWidth(v) { checkNum('lineWidth', v, frameTag); state.lineWidth = v; },
    get globalAlpha() { return state.globalAlpha; },
    set globalAlpha(v) { checkNum('globalAlpha', v, frameTag); state.globalAlpha = v; },
    get font() { return state.font; },
    set font(v) { state.font = v; },
    get textAlign() { return state.textAlign; },
    set textAlign(v) { state.textAlign = v; },
    get textBaseline() { return state.textBaseline; },
    set textBaseline(v) { state.textBaseline = v; },
    get lineCap() { return state.lineCap; },
    set lineCap(v) { state.lineCap = v; },

    save: noop, restore: noop, beginPath: noop, closePath: noop, fill: noop, stroke: noop,
    setLineDash: (a) => { stats.ops++; (a || []).forEach((n) => checkNum('setLineDash', n, frameTag)); },
    clearRect: (x, y, w, h) => { stats.ops++; [x, y, w, h].forEach((n) => checkNum('clearRect', n, frameTag)); },
    fillRect: (x, y, w, h) => { stats.ops++; [x, y, w, h].forEach((n) => checkNum('fillRect', n, frameTag)); },
    strokeRect: (x, y, w, h) => { stats.ops++; [x, y, w, h].forEach((n) => checkNum('strokeRect', n, frameTag)); },
    moveTo: (x, y) => { stats.ops++; [x, y].forEach((n) => checkNum('moveTo', n, frameTag)); },
    lineTo: (x, y) => { stats.ops++; [x, y].forEach((n) => checkNum('lineTo', n, frameTag)); },
    arc: (x, y, r, a1, a2) => {
      stats.ops++;
      [x, y, r, a1, a2].forEach((n) => checkNum('arc', n, frameTag));
      ok(r >= 0, `${frameTag} arc 半径为负（${r}）`);
    },
    scale: (a, b) => { stats.ops++; [a, b].forEach((n) => checkNum('scale', n, frameTag)); },
    fillText: (text, x, y) => {
      stats.ops++;
      checkNum('fillText.x', x, frameTag);
      checkNum('fillText.y', y, frameTag);
      stats.texts.push({ text, x, y, font: state.font, align: state.textAlign });
    },
    measureText: (t) => ({ width: estWidth(t, 16) })
  };

  return { ctx, stats };
}

function checkNum(where, v, frameTag) {
  if (typeof v === 'number' && !Number.isFinite(v)) {
    fails.push(`${frameTag} ${where} 出现非有限数值 ${v}`);
  }
}

/* 检查一条文字的绘制是否越界 */
function checkTextBounds(rec, W, H, frameTag) {
  const m = /(\d+(?:\.\d+)?)px/.exec(rec.font || '');
  const fs = m ? parseFloat(m[1]) : 16;
  const w = estWidth(rec.text, fs);
  let left = rec.x;
  if (rec.align === 'center') left = rec.x - w / 2;
  else if (rec.align === 'right') left = rec.x - w;
  const right = left + w;

  if (left < -3 || right > W + 3) {
    fails.push(`${frameTag} 文字「${rec.text}」横向越界（${left.toFixed(0)}~${right.toFixed(0)}，画布 0~${W}）`);
  }
  if (rec.y - fs / 2 < -3 || rec.y + fs / 2 > H + 3) {
    fails.push(`${frameTag} 文字「${rec.text}」纵向越界（y=${rec.y.toFixed(0)}，画布 0~${H}）`);
  }
}

/* ---------- 跑 ---------- */
const W = 343; // 小程序里 canvas 的实际逻辑宽度（约 375 - 32 padding）
const H = 240;

const ids = Object.keys(engine.SCENES);
console.log(`==== 动画逐帧扫描（${ids.length} 个场景，${W}×${H}）====`);

let totalFrames = 0;
ids.forEach((id) => {
  const dur = engine.duration(id);
  const stepSec = 0.05;
  const frames = Math.ceil(dur / stepSec);
  let blank = 0;
  let textCount = 0;

  for (let i = 0; i <= frames; i++) {
    const t = Math.min(i * stepSec, dur);
    const tag = `${id}@${t.toFixed(2)}s`;
    const { ctx, stats } = makeCtx(W, H, tag);
    try {
      engine.drawFrame(ctx, W, H, t, id);
    } catch (e) {
      fails.push(`${tag} 抛异常：${e.message}`);
      continue;
    }
    totalFrames++;
    // 每帧至少有 2 次绘制调用（铺背景 + 内容），只有背景说明这帧是空的
    if (stats.ops <= 2) blank++;
    stats.texts.forEach((r) => {
      textCount++;
      checkTextBounds(r, W, H, tag);
    });
  }

  ok(blank === 0, `${id} 有 ${blank} 帧几乎空白（只铺了背景）`);
  console.log(`  ${id.padEnd(12)} 时长 ${dur}s，扫 ${frames + 1} 帧，文字 ${textCount} 处`);
});

/* 场景/映射一致性：映射表里写的场景必须真实存在 */
Object.entries(MAP).forEach(([nodeId, sceneId]) => {
  ok(engine.has(sceneId), `映射 ${nodeId} → ${sceneId} 指向不存在的场景`);
});

console.log('\n==== 结果 ====');
if (fails.length) {
  const uniq = [...new Set(fails)];
  console.log(`❌ ${fails.length} 处问题（去重后 ${uniq.length} 类）：`);
  uniq.slice(0, 20).forEach((f) => console.log('   · ' + f));
  if (uniq.length > 20) console.log(`   ... 其余 ${uniq.length - 20} 类省略`);
  process.exit(1);
}
console.log(`✅ ${ids.length} 个场景共 ${totalFrames} 帧，无 NaN / 无越界 / 无空帧；映射表场景全部存在`);
