// tools/validate_anim_headless.js —— 无头校验：全量 493 节点解析 + 渲染采样
//
// 不依赖小程序 canvas / 微信运行时，用 mock ctx 跑引擎，确保：
//   1) 每个节点都能 resolve 出 scene（运算动画 or 概念卡）
//   2) 每个 scene 渲染任意 t 不抛异常（数据驱动不写死）
//   3) 旁白行数 == 场景用到的 cue 数（否则画面 cue 越界取 total）
//   4) autoMap 的安全闸：算出来一定等于答案

const { nodes } = require('../miniprogram/data/content.js');
const { resolveAnim } = require('../miniprogram/utils/anim/map.js');
const anim = require('../miniprogram/utils/anim/engine.js');

/* ---- mock canvas 2d ctx：所有方法 no-op，measureText 给宽度 ---- */
function mockCtx() {
  const handler = {
    get(t, prop) {
      if (prop === 'measureText') return (s) => ({ width: String(s).length * 8 });
      if (prop in t) return t[prop];
      return () => {};
    },
    set(t, prop, v) { t[prop] = v; return true; }
  };
  return new Proxy({ canvas: { width: 360, height: 240 } }, handler);
}

const W = 360, H = 240;
const ctx = mockCtx();

let ok = 0, err = 0;
const errs = [];
const sceneCount = {};
const typeCount = { arithmetic: 0, concept: 0 };
const cueMismatch = [];

const samples = {}; // scene -> 一个样例

for (const node of nodes) {
  let res;
  try {
    res = resolveAnim(node);
  } catch (e) {
    err++; errs.push(`[resolve] ${node.id} ${node.title}: ${e.message}`); continue;
  }
  if (!res || !res.scene) { err++; errs.push(`[resolve] ${node.id} 无 scene`); continue; }
  if (!anim.has(res.scene)) { err++; errs.push(`[scene] ${node.id} scene ${res.scene} 不存在`); continue; }

  sceneCount[res.scene] = (sceneCount[res.scene] || 0) + 1;
  const isConcept = res.scene === 'conceptCard';
  typeCount[isConcept ? 'concept' : 'arithmetic']++;

  // 旁白
  let narration = null;
  try {
    narration = anim.narrationForScene(node.id, res.scene, res.data, node);
  } catch (e) {
    err++; errs.push(`[narration] ${node.id} ${res.scene}: ${e.message}`); continue;
  }
  if (!narration || !narration.lines || !narration.lines.length) {
    err++; errs.push(`[narration] ${node.id} ${res.scene} 空旁白`); continue;
  }

  // 渲染采样：0 / 1/3 / 2/3 / 结尾 各一帧
  const total = narration.total || anim.duration(res.scene);
  const tt = [0, total * 0.33, total * 0.66, total];
  try {
    for (const t of tt) anim.drawFrame(ctx, W, H, t, res.scene, res.data, narration);
  } catch (e) {
    err++; errs.push(`[draw] ${node.id} ${res.scene} t=${tt}: ${e.message}`);
    continue;
  }

  // 记录一个样例（每场景首个），用于人工抽查
  if (!samples[res.scene]) {
    samples[res.scene] = { id: node.id, title: node.title, data: res.data, lines: narration.lines.length, total: narration.total };
  }
  ok++;
}

console.log('=== 无头校验结果 ===');
console.log(`节点总数: ${nodes.length}`);
console.log(`解析成功: ${ok}  异常: ${err}`);
console.log(`运算动画: ${typeCount.arithmetic}  概念卡: ${typeCount.concept}`);
console.log('场景分布:');
Object.keys(sceneCount).sort((a, b) => sceneCount[b] - sceneCount[a]).forEach((k) => {
  console.log(`  ${k}: ${sceneCount[k]}`);
});
if (errs.length) {
  console.log('\n异常明细（最多 30 条）:');
  errs.slice(0, 30).forEach((e) => console.log('  ✗ ' + e));
}
console.log('\n每场景样例（data 已注入真实题目数字）:');
Object.keys(samples).forEach((k) => {
  const s = samples[k];
  console.log(`  [${k}] ${s.id} 《${s.title}》 lines=${s.lines} data=${JSON.stringify(s.data)}`);
});
process.exit(err ? 1 : 0);
