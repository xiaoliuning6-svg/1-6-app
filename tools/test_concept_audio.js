// tools/test_concept_audio.js —— 概念卡语音索引 vs 实际 mp3 的一致性校验
//
// 抓四类问题（都是实际会发生的）：
//   1. 改了 narration_kp 的文案，但没重跑 gen_concept_audio.py
//      → 字数指纹对不上，客户端会静默退回字幕（听不出错，但也没声了）
//   2. 索引里有、文件没生成（中途失败）
//   3. 文件存在但被截断/损坏（大小与实测时长严重不符）
//   4. 时间轴自洽性：total = Σdur + 句间停顿 + 尾部留白
//
// 运行：node tools/test_concept_audio.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');
const AUDIO_DIR = path.join(ROOT, 'cloud_assets', 'anim', 'concept');

const { CONCEPT_AUDIO } = require(path.join(MP, 'utils/anim/narration_concept.js'));
const { nodes } = require(path.join(MP, 'data/content.js'));
const { resolveAnim } = require(path.join(MP, 'utils/anim/map.js'));
const { genNarration } = require(path.join(MP, 'utils/anim/narration_kp.js'));

const GAP = 0.18;
const TAIL = 0.80;
const BYTES_PER_SEC = 48 * 1000 / 8;   // edge-tts 输出 48kbps / mono

let bad = 0;
const ok = (cond, msg) => { if (!cond) { console.log('  ❌ ' + msg); bad++; } };

const ids = Object.keys(CONCEPT_AUDIO);
console.log('==== 概念卡语音一致性 ====');
console.log(`索引节点 ${ids.length} 个，文件目录 ${fs.existsSync(AUDIO_DIR) ? fs.readdirSync(AUDIO_DIR).length : 0} 个`);

if (!ids.length) {
  console.log('  ⚠️ 索引是空的（还没跑 gen_concept_audio.py？）');
  process.exit(0);
}

// 概念卡节点集合（与索引必须一一对应）
const conceptNodes = [];
nodes.forEach((n) => {
  const r = resolveAnim(n);
  if (r && r.scene === 'conceptCard') conceptNodes.push(n);
});
ok(conceptNodes.length === ids.length,
  `概念卡节点 ${conceptNodes.length} 个，但索引里有 ${ids.length} 个`);

let totalDur = 0;
let totalBytes = 0;
let missFile = 0;
let driftText = 0;

for (let k = 0; k < conceptNodes.length; k++) {
  const node = conceptNodes[k];
  const a = CONCEPT_AUDIO[node.id];
  if (!a) { ok(false, `${node.id} 是概念卡但索引里没有`); continue; }

  const res = resolveAnim(node);
  const nar = genNarration(res.scene, res.data, node);
  const texts = nar.lines.map((l) => l.text);

  ok(a.d.length === texts.length, `${node.id} 句数 ${a.d.length} ≠ 当前文案 ${texts.length} 句`);
  ok(a.n.length === texts.length, `${node.id} 字数指纹长度 ${a.n.length} ≠ ${texts.length}`);

  let sum = 0;
  for (let i = 0; i < texts.length; i++) {
    // 1. 字数指纹
    if (a.n[i] !== texts[i].length) {
      driftText++;
      ok(false, `${node.id}[${i}] 文案已变（索引 ${a.n[i]} 字 / 现在 ${texts[i].length} 字），需重跑 gen_concept_audio.py`);
    }
    // 2. 文件
    const p = path.join(AUDIO_DIR, node.id, i + '.mp3');
    if (!fs.existsSync(p)) { missFile++; ok(false, `${node.id}[${i}] 缺文件 ${path.relative(ROOT, p)}`); continue; }
    const size = fs.statSync(p).size;
    totalBytes += size;
    const est = size / BYTES_PER_SEC;
    // 3. 大小反推时长（±35% 容差，抓截断/半个文件）
    if (a.d[i] > 0.6 && Math.abs(est - a.d[i]) / a.d[i] > 0.35) {
      ok(false, `${node.id}[${i}] 大小反推 ${est.toFixed(2)}s 与索引 ${a.d[i]}s 相差过大（${(size / 1024).toFixed(0)}KB）`);
    }
    sum += a.d[i];
    totalDur += a.d[i];
  }
  // 4. total 自洽
  const expect = sum + GAP * (texts.length - 1) + TAIL;
  if (Math.abs(expect - a.t) > 0.15) {
    ok(false, `${node.id} total ${a.t}s 与 Σdur 推算 ${expect.toFixed(2)}s 不符`);
  }
}

if (bad === 0) {
  console.log(`✅ ${ids.length} 个节点 / ${ids.length * 5} 句全部对齐`);
  console.log(`   音频 ${(totalBytes / 1048576).toFixed(1)} MB，总时长 ${(totalDur / 60).toFixed(1)} 分钟`);
  console.log(`   平均每节 ${(totalBytes / ids.length / 1024).toFixed(0)} KB`);
} else {
  console.log(`\n共 ${bad} 处问题${driftText ? `，其中 ${driftText} 句是文案漂移` : ''}${missFile ? `，${missFile} 句缺文件` : ''}`);
  process.exit(1);
}

/* ---- 配置检查：本地对得上 ≠ 客户端能放声，还差「云端前缀 + 云环境」两步 ---- */
console.log('\n==== 客户端配置检查 ====');
const cacheSrc = fs.readFileSync(path.join(MP, 'utils/anim/audioCache.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(MP, 'app.js'), 'utf8');

const prefixMatch = cacheSrc.match(/fileIdPrefix:\s*'([^']*)'/);
const prefix = prefixMatch ? prefixMatch[1] : '';
const envMatch = appSrc.match(/env:\s*'([^']*)'/);
const env = envMatch ? envMatch[1] : '';

const envOk = env && env !== 'your-cloud-env-id';
const prefixOk = !!prefix;

console.log(`  云环境 env: ${envOk ? env : '（还是占位符）'}`);
console.log(`  音频前缀  : ${prefixOk ? prefix : '（还没填）'}`);
if (!envOk || !prefixOk) {
  console.log('  ⚠️ 还没配好，客户端会直接跳过下载走纯字幕（不报错、不影响使用）。');
  console.log('     上传 cloud_assets/anim/concept 后，按 cloud_assets/上传说明.md 填两处：');
  console.log('       app.js 的 env、utils/anim/audioCache.js 的 REMOTE.fileIdPrefix');
} else {
  console.log('  ✓ 配置齐了，真机进概念卡应能看到「字幕模式 → 语音讲解」切换');
}
