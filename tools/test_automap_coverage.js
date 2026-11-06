// tools/test_automap_coverage.js —— 跑全量 493 节点，统计 autoMap 覆盖
const { nodes } = require('../miniprogram/data/content.js');
const { autoMap } = require('../miniprogram/utils/anim/autoMap.js');

const tally = {};
let covered = 0;
const samples = {};
nodes.forEach((n) => {
  const r = autoMap(n);
  if (r) {
    covered++;
    tally[r.scene] = (tally[r.scene] || 0) + 1;
    if (!samples[r.scene]) samples[r.scene] = [];
    if (samples[r.scene].length < 3) samples[r.scene].push({ id: n.id, title: n.title, data: r.data, stem: (n.questions[0] && n.questions[0].stem) || '' });
  }
});

console.log(`总节点 ${nodes.length}，命中 ${covered}（${(covered / nodes.length * 100).toFixed(1)}%），未命中 ${nodes.length - covered}`);
console.log('场景分布：');
Object.keys(tally).sort((a, b) => tally[b] - tally[a]).forEach((k) => {
  console.log(`  ${k}: ${tally[k]}`);
});
console.log('\n各场景样例：');
Object.keys(samples).forEach((k) => {
  console.log(`\n[${k}]`);
  samples[k].forEach((s) => {
    console.log(`  ${s.id} 《${s.title}》 data=${JSON.stringify(s.data)}`);
    console.log(`     题干: ${s.stem.slice(0, 60)}`);
  });
});

// 未命中节点的主题抽样（看有没有可加场景的大簇）
const uncovered = nodes.filter((n) => !autoMap(n));
console.log(`\n未命中 ${uncovered.length} 个，按年级抽样主题：`);
const byGrade = {};
uncovered.forEach((n) => { (byGrade[n.grade] = byGrade[n.grade] || []).push(n.title); });
Object.keys(byGrade).forEach((g) => {
  console.log(`  年级${g}（${byGrade[g].length}）示例：${byGrade[g].slice(0, 6).join(' / ')}`);
});

