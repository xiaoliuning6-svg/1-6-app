// tools/pack_audio_subpackages.js —— 把 per-node 语音按体积切进多个分包
//
// 为什么需要：微信「单个分包」上限是 2048KB（20MB 是总包上限，不是单包）。
// 58 个运算节点的逐句 mp3 共约 5.4MB，塞进一个 assets 分包直接超限。
// 这里按体积把它们切成 3 组，分别放进 assets2/assets3/assets4 三个分包
// （每个 <1900KB，留余量），旗舰 4 套旁白仍留在 assets/audio。
//
// 同时重建 narration_nodes.js：file 改成「从 miniprogram 根算起」的完整路径
// （assets2/<nodeId>/0.mp3），并记录每个节点落在哪个分包（NODE_SUBPKG），
// learn 层据此按需加载对应分包。
//
// 前置：先跑 tools/gen_node_audio.py 生成 mp3 + 时长缓存。
// 用法：node tools/pack_audio_subpackages.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');
const AUDIO_DIR = path.join(MP, 'assets', 'audio');
const DUMP = require('./_anim_narration_dump.json');
const DUR = JSON.parse(fs.readFileSync(path.join(__dirname, '_node_durations.json'), 'utf-8'));
const OUT_JS = path.join(MP, 'utils', 'anim', 'narration_nodes.js');

const CAP_KB = 1900;          // 每组上限（KB），留 148KB 给 blank 页与开销
const GAP = 0.18;
const TAIL = 0.80;

/* 节点目录可能已在上次运行搬进 assets2/3/4，扫描所有候选根，保证可重跑 */
function findNodeDir(id) {
  const cands = [AUDIO_DIR,
    path.join(MP, 'assets1'), path.join(MP, 'assets2'),
    path.join(MP, 'assets3'), path.join(MP, 'assets4')];
  for (const c of cands) {
    const d = path.join(c, id);
    if (fs.existsSync(d)) return d;
  }
  return null;
}

/* 1. 统计每个节点目录体积 */
const items = DUMP.map((e) => {
  const dir = findNodeDir(e.id);
  let bytes = 0;
  if (dir) {
    for (const f of fs.readdirSync(dir)) bytes += fs.statSync(path.join(dir, f)).size;
  }
  return { id: e.id, kb: bytes / 1024 };
});

/* 2. 首次适应递减装箱 → 分桶 */
const sorted = items.slice().sort((a, b) => b.kb - a.kb);
const buckets = [];
for (const it of sorted) {
  let placed = false;
  for (const b of buckets) {
    if (b.kb + it.kb <= CAP_KB) { b.items.push(it.id); b.kb += it.kb; placed = true; break; }
  }
  if (!placed) buckets.push({ items: [it.id], kb: it.kb });
}

/* 3. 建分包根目录 + blank 页 + 移动节点目录 */
const blankSrc = path.join(MP, 'assets', 'pages', 'blank');
const roots = [];   // { root, name, nodeIds }
buckets.forEach((b, i) => {
  const idx = i + 1;                       // assets2 起
  const rootName = 'assets' + idx;         // 目录名
  const pkgName = 'audio' + idx;           // 分包别名
  const rootDir = path.join(MP, rootName);
  const pageDir = path.join(rootDir, 'pages', 'blank');
  fs.mkdirSync(pageDir, { recursive: true });
  for (const f of fs.readdirSync(blankSrc)) {
    fs.copyFileSync(path.join(blankSrc, f), path.join(pageDir, f));
  }
  for (const id of b.items) {
    const dst = path.join(rootDir, id);
    if (fs.existsSync(dst)) continue;       // 已在目标位置（幂等）
    const src = findNodeDir(id);
    if (src && src !== dst) fs.renameSync(src, dst);
  }
  roots.push({ root: rootName, name: pkgName, nodeIds: b.items });
});

/* 4. 重建 narration_nodes.js（完整路径 + 分包映射） */
const nodePkg = {};
roots.forEach((r) => r.nodeIds.forEach((id) => { nodePkg[id] = r.name; }));

function esc(s) { return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function renderJs() {
  let out = '// utils/anim/narration_nodes.js —— 运算动画节点的预打包逐句旁白（per-node）\n'
    + '//\n'
    + '// ⚠️ 本文件由 tools/pack_audio_subpackages.js 自动生成，不要手改。\n'
    + '//    文案来自 tools/_anim_narration_dump.json；mp3 由 tools/gen_node_audio.py 生成。\n'
    + '//    改文案 → 重跑 dump → gen_node_audio.py → pack_audio_subpackages.js。\n'
    + '//\n'
    + '// 微信单个分包上限 2048KB，58 节点语音按体积切进 assets2/3/4 三个分包；\n'
    + '// file 是从 miniprogram 根算起的完整路径；NODE_SUBPKG 记录节点所属分包名，\n'
    + '// learn 页按需 wx.loadSubpackage 对应分包后再播。\n\n'
    + 'const NARRATION_NODES = {\n';
  for (const e of DUMP) {
    const pkg = roots.find((r) => r.nodeIds.indexOf(e.id) >= 0);
    const rootName = pkg ? pkg.root : 'assets';
    // 先排时间轴，算出 total，再一次性拼出该节点块
    let t = 0;
    const lines = [];
    for (let i = 0; i < e.texts.length; i++) {
      const dur = DUR[`${e.id}/${i}`];
      lines.push({ t: Math.round(t * 100) / 100, dur: Math.round(dur * 100) / 100, text: e.texts[i], file: `${rootName}/${e.id}/${i}.mp3` });
      t += dur + GAP;
    }
    const total = Math.round((t - GAP + TAIL) * 100) / 100;
    out += `  '${e.id}': {\n    total: ${total},\n    lines: [\n`;
    for (const ln of lines) {
      out += `      { t: ${ln.t}, dur: ${ln.dur}, text: '${esc(ln.text)}', file: '${ln.file}' },\n`;
    }
    out += '    ]\n  },\n';
  }
  out += '};\n\n';
  out += 'const NODE_SUBPKG = {\n';
  for (const id in nodePkg) out += `  '${id}': '${nodePkg[id]}',\n`;
  out += '};\n\n';
  out += 'function narrationNodeOf(nodeId) { return NARRATION_NODES[nodeId] || null; }\n';
  out += 'function subpackageOf(nodeId) { return NODE_SUBPKG[nodeId] || null; }\n\n';
  out += 'module.exports = { NARRATION_NODES, NODE_SUBPKG, narrationNodeOf, subpackageOf };\n';
  return out;
}
fs.writeFileSync(OUT_JS, renderJs(), 'utf-8');

/* 5. 汇总 */
const real = roots.map((r) => {
  let kb = 0;
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p); if (st.isDirectory()) walk(p); else kb += st.size; } };
  walk(path.join(MP, r.root));
  return { ...r, kb: kb / 1024 };
});
console.log('分包规划：');
real.forEach((r) => console.log(`  ${r.root} (name=${r.name})  ${r.kb.toFixed(0)} KB  ${r.nodeIds.length} 个节点`));
console.log(`  合计 ${real.reduce((s, r) => s + r.kb, 0).toFixed(0)} KB（上限 2048/包）`);
console.log(`→ ${path.relative(ROOT, OUT_JS)}`);
