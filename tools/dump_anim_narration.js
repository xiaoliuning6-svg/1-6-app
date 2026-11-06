// tools/dump_anim_narration.js —— 把需要补语音的运算节点导成文案 JSON
//
// 只导「运算动画」节点（resolveAnim 给出非 conceptCard 的 scene，且不是 7 个旗舰
// 旗舰节点已经有预打包语音）。概念卡节点维持字幕、不生成语音。
// 文案用 narration_kp.genNarration 生成，确保和页面字幕完全一致。

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

const out = [];
let skippedConcept = 0;
let skippedLegacy = 0;

for (const node of nodes) {
  const res = resolveAnim(node);
  if (!res || !res.scene) continue;
  if (res.scene === 'conceptCard') { skippedConcept++; continue; }
  if (LEGACY.has(node.id)) { skippedLegacy++; continue; }
  const narr = genNarration(res.scene, res.data, node);
  if (!narr || !narr.lines || !narr.lines.length) continue;
  out.push({
    id: node.id,
    scene: res.scene,
    texts: narr.lines.map((l) => l.text)
  });
}

const dumpPath = path.join(__dirname, '_anim_narration_dump.json');
fs.writeFileSync(dumpPath, JSON.stringify(out, null, 1), 'utf-8');
console.log(`导出 ${out.length} 个运算节点（概念卡 ${skippedConcept} 跳过、旗舰 ${skippedLegacy} 跳过）`);
console.log(`→ ${dumpPath}`);
