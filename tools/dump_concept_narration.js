// tools/dump_concept_narration.js —— 把「概念卡」节点的讲解文案导成 JSON
//
// 概念卡 = resolveAnim 兜底到 scene==='conceptCard' 的节点（认识数、测量、几何性质、
// 大数、统计等无法参数化成运算动画的节）。它们的文案完全来自节点自身的
// title / story / wrongTip，不走题目数字，所以可以一次性把 428 句段全部导出来配音。
//
// 这些语音不进小程序包（单分包 2048KB 装不下 ~40MB），而是走云存储 + 客户端按需
// 下载缓存，见 utils/anim/audioCache.js。
//
// 文案用 narration_kp.genNarration 生成，与页面字幕严格同源。

const fs = require('fs');
const path = require('path');
const { nodes } = require('../miniprogram/data/content.js');
const { resolveAnim } = require('../miniprogram/utils/anim/map.js');
const { genNarration } = require('../miniprogram/utils/anim/narration_kp.js');

const LEGACY = new Set([
  'bsd-g1s-010', 'bsd-g1x-004',
  'bsd-g3x-015', 'bsd-g3x-016', 'bsd-g3x-017', 'bsd-g3x-018',
  'bsd-g5x-013'
]);

// edge-tts 读不对的字符：阿拉伯数字（含小数）、斜杠、乘除号、破折号、百分号
const UNSAFE = /[0-9０-９\/／×÷—–%％]/;

const out = [];
const unsafe = [];
let skippedOp = 0;
let skippedLegacy = 0;

for (const node of nodes) {
  const res = resolveAnim(node);
  if (!res || !res.scene) continue;
  if (LEGACY.has(node.id)) { skippedLegacy++; continue; }
  if (res.scene !== 'conceptCard') { skippedOp++; continue; }

  const narr = genNarration(res.scene, res.data, node);
  if (!narr || !narr.lines || !narr.lines.length) continue;
  const texts = narr.lines.map((l) => l.text);
  out.push({ id: node.id, book: node.book, title: node.title, texts });
  texts.forEach((t, i) => { if (UNSAFE.test(t)) unsafe.push({ id: node.id, i, t }); });
}

const dumpPath = path.join(__dirname, '_concept_narration_dump.json');
fs.writeFileSync(dumpPath, JSON.stringify(out, null, 1), 'utf-8');

const lines = out.reduce((a, e) => a + e.texts.length, 0);
const chars = out.reduce((a, e) => a + e.texts.reduce((b, t) => b + t.length, 0), 0);
console.log(`导出 ${out.length} 个概念卡节点 / ${lines} 句 / ${chars} 字`);
console.log(`跳过：运算节点 ${skippedOp}、旗舰 ${skippedLegacy}`);
console.log(`含 TTS 禁字符的句子：${unsafe.length}`);
unsafe.slice(0, 25).forEach((u) => console.log(`  [${u.id}#${u.i}] ${u.t}`));
console.log(`→ ${dumpPath}`);
