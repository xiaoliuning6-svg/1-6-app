// tools/test_narration.js —— 旁白与动画的一致性校验
//
// 存在的理由：narration.js 是 gen_narration.py 生成的，scenes.js 是手写的。
// 两边任何一边单独改动，都会造成「画面在演第 3 步，嘴里在讲第 2 步」——
// 这种错光看代码看不出来，必须靠断言。
//
// 检查：
//   1. 场景 ↔ 旁白 双向一一对应（有场景没旁白 = 哑动画；有旁白没场景 = 白占空间）
//   2. 时间轴单调不重叠，每句 t/dur 都是有限数
//   3. mp3 文件存在，且实测时长与 narration.js 记的 dur 一致（误差 < 0.1 秒）
//      —— 不一致说明改过文案没重跑生成脚本，音频和字幕会错位
//   4. 文案本身不能踩 TTS 的坑（破折号不读、斜杠读成「一横」、阿拉伯数字读法乱）
//   5. indexAt 的边界行为（句首 / 句间隙 / 结尾）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');
const AUDIO_DIR = path.join(MP, 'assets', 'audio');

const SCENES = require(path.join(MP, 'utils/anim/scenes.js'));
const { NARRATION, cueOf, narrationOf } = require(path.join(MP, 'utils/anim/narration.js'));
const { NARRATION_NODES, narrationNodeOf } = require(path.join(MP, 'utils/anim/narration_nodes.js'));
const { indexAt } = require(path.join(MP, 'utils/anim/player.js'));
const { MAP, resolveAnim } = require(path.join(MP, 'utils/anim/map.js'));
const { narrationForScene } = require(path.join(MP, 'utils/anim/engine.js'));
const { nodes } = require(path.join(MP, 'data/content.js'));

let fails = 0;
function ok(cond, msg) {
  if (!cond) { console.log('  ❌ ' + msg); fails++; }
}
function eq(a, b, msg) {
  ok(a === b, `${msg}（期望 ${b}，实际 ${a}）`);
}

/* ---------- mp3 时长（CBR，直接按帧头算） ---------- */
const BR_V2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const BR_V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const SR_V1 = [44100, 48000, 32000, 0];
const SR_V2 = [22050, 24000, 16000, 0];

function mp3Duration(buf) {
  let i = 0;
  if (buf.slice(0, 3).toString() === 'ID3') {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    i = 10 + size;
  }
  let samples = 0;
  let rate = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) { i++; continue; }
    const ver = (buf[i + 1] >> 3) & 0x03;
    const layer = (buf[i + 1] >> 1) & 0x03;
    const brIdx = (buf[i + 2] >> 4) & 0x0f;
    const srIdx = (buf[i + 2] >> 2) & 0x03;
    const pad = (buf[i + 2] >> 1) & 0x01;
    if (layer !== 1 || brIdx === 0 || brIdx === 15 || srIdx === 3) { i++; continue; }
    const v1 = ver === 3;
    const bitrate = (v1 ? BR_V1L3[brIdx] : BR_V2L3[brIdx]) * 1000;
    const sr = (v1 ? SR_V1[srIdx] : SR_V2[srIdx]);
    const spf = v1 ? 1152 : 576;
    if (!bitrate || !sr) { i++; continue; }
    const flen = Math.floor(spf / 8 * bitrate / sr) + pad;
    if (flen <= 4) { i++; continue; }
    rate = sr;
    samples += spf;
    i += flen;
  }
  return rate ? samples / rate : 0;
}

console.log('==== 旁白与动画一致性 ====');

const sceneIds = Object.keys(SCENES);
const narrIds = Object.keys(NARRATION);

/* 1. 双向对应
 *   混合模型下，一个场景的旁白可能来自三处之一：
 *     · 旗舰 per-scene 旁白（NARRATION）
 *     · per-node 预打包旁白（NARRATION_NODES，按 nodeId 检索）
 *     · 运行时 genNarration（conceptCard 等）
 *   所以「场景必须有 per-scene 旁白」只适用于「没有任何节点用到该场景」的情况。
 *   先统计所有节点实际用到的场景集合，用到过即视为已被某条管线覆盖。 */
const usedScenes = new Set();
const firstNodeByScene = {};
nodes.forEach((n) => {
  const r = resolveAnim(n);
  if (r && r.scene) {
    usedScenes.add(r.scene);
    if (!firstNodeByScene[r.scene]) firstNodeByScene[r.scene] = { node: n, r };
  }
});

sceneIds.forEach((id) => {
  const entry = firstNodeByScene[id];
  if (!entry) {
    // 场景存在但没有节点用到：死代码，提示清理，不算失败（不影响运行时）
    console.log(`  · 场景 ${id} 未被任何节点使用（死代码，可清理）`);
    return;
  }
  // 被用到的场景，必须能通过 narrationForScene 取到旁白（per-scene / per-node / 运行时生成皆可）
  const nar = narrationForScene(entry.node.id, id, entry.r.data, entry.node);
  ok(nar && nar.lines && nar.lines.length > 0,
    `场景 ${id} 被 ${entry.node.id} 使用，但取不到旁白（哑动画）`);
});
narrIds.forEach((id) => ok(sceneIds.indexOf(id) >= 0, `旁白 ${id} 没有对应场景（白占分包空间）`));

/* 2~4. 逐场景逐句 */
let totalBytes = 0;
let totalLines = 0;
const problems = [];

sceneIds.forEach((id) => {
  const n = narrationOf(id);
  if (!n) return;
  ok(Array.isArray(n.lines) && n.lines.length > 0, `${id} 旁白为空`);
  let prevEnd = -1;
  n.lines.forEach((ln, i) => {
    totalLines++;
    ok(Number.isFinite(ln.t) && Number.isFinite(ln.dur) && ln.dur > 0,
      `${id}[${i}] t/dur 非法：t=${ln.t} dur=${ln.dur}`);
    ok(ln.t >= prevEnd - 0.001, `${id}[${i}] 与上一句重叠（t=${ln.t} 上一句结束 ${prevEnd}）`);
    prevEnd = ln.t + ln.dur;

    ok(typeof ln.text === 'string' && ln.text.length >= 3 && ln.text.length <= 40,
      `${id}[${i}] 文案长度 ${ln.text ? ln.text.length : 0} 不在 3~40 字`);
    ok(!/——|--/.test(ln.text), `${id}[${i}] 含破折号，TTS 不会读`);
    ok(!/[\/／]/.test(ln.text), `${id}[${i}] 含斜杠，TTS 会读成「一横」，分数必须写「几分之几」`);
    ok(!/[0-9]/.test(ln.text), `${id}[${i}] 含阿拉伯数字，TTS 读法不可控，请写中文数字`);

    eq(ln.file, `${id}/${i}.mp3`, `${id}[${i}] 文件名不符合 <场景>/<序号>.mp3`);

    const p = path.join(AUDIO_DIR, ln.file);
    if (!fs.existsSync(p)) {
      problems.push(`${id}[${i}] 缺音频文件 ${ln.file}`);
      fails++;
      return;
    }
    const buf = fs.readFileSync(p);
    totalBytes += buf.length;
    const real = mp3Duration(buf);
    const drift = Math.abs(real - ln.dur);
    if (drift > 0.1) {
      problems.push(`${id}[${i}] 音频实测 ${real.toFixed(2)}s，narration.js 记 ${ln.dur}s，差 ${drift.toFixed(2)}s（改过文案没重跑生成脚本？）`);
      fails++;
    }
  });

  // 5. total 要覆盖最后一句 + 尾巴
  const last = n.lines[n.lines.length - 1];
  ok(n.total >= last.t + last.dur, `${id} total ${n.total} 没覆盖最后一句结束点 ${(last.t + last.dur).toFixed(2)}`);
  ok(n.total - (last.t + last.dur) <= 2.5, `${id} 结尾空等太久（多出 ${(n.total - last.t - last.dur).toFixed(2)}s）`);

  console.log(`  ${id.padEnd(13)} ${String(n.lines.length).padStart(2)} 句  ${n.total.toFixed(2)}s  ${(n.lines.reduce((s, l) => s + l.dur, 0)).toFixed(2)}s 有声`);
});

/* 5. indexAt 边界 */
const L = narrationOf('addMeaning').lines;
eq(indexAt(L, 0), 0, 't=0 应为第 1 句');
eq(indexAt(L, L[0].t + L[0].dur - 0.01), 0, '第 1 句末尾仍在第 1 句');
eq(indexAt(L, L[0].t + L[0].dur + 0.05), -1, '句间隙应返回 -1（不切字幕，避免闪一下）');
eq(indexAt(L, L[1].t + 0.01), 1, '第 2 句开头');
eq(indexAt(L, 9999), -1, '超出范围返回 -1');
eq(indexAt(null, 1), -1, 'null 输入返回 -1');

/* cueOf 越界不能返回 NaN —— NaN 传进绘制会让整帧静默不画 */
ok(Number.isFinite(cueOf('addMeaning', 0)), 'cueOf 正常取值为有限数');
ok(cueOf('addMeaning', 99) === narrationOf('addMeaning').total, 'cueOf 越界应退回总时长');
ok(cueOf('不存在的场景', 0) === 0, 'cueOf 未知场景应返回 0');

/* 6. 映射表里的每个知识点，其场景都要有旁白 */
Object.keys(MAP).forEach((nodeId) => {
  const sid = MAP[nodeId];
  ok(!!SCENES[sid], `映射 ${nodeId} → ${sid}，但场景不存在`);
  ok(!!NARRATION[sid], `映射 ${nodeId} → ${sid}，但该场景没有旁白`);
});

/* 7. per-node 预打包旁白（运算动画节点，按 nodeId 检索）一致性校验 */
console.log('\n==== per-node 预打包旁白（运算节点，按 nodeId）====');
const nodeIds = Object.keys(NARRATION_NODES);
let nodeLines = 0;
const nodeProblems = [];
nodeIds.forEach((nid) => {
  const n = narrationNodeOf(nid);
  ok(!!n, `narrationNodeOf(${nid}) 返回 null`);
  if (!n) return;
  ok(Array.isArray(n.lines) && n.lines.length > 0, `${nid} 旁白为空`);
  let prevEnd = -1;
  n.lines.forEach((ln, i) => {
    nodeLines++;
    ok(Number.isFinite(ln.t) && Number.isFinite(ln.dur) && ln.dur > 0,
      `${nid}[${i}] t/dur 非法：t=${ln.t} dur=${ln.dur}`);
    ok(ln.t >= prevEnd - 0.001, `${nid}[${i}] 与上一句重叠（t=${ln.t} 上一句结束 ${prevEnd}）`);
    prevEnd = ln.t + ln.dur;
    ok(typeof ln.text === 'string' && ln.text.length >= 3 && ln.text.length <= 40,
      `${nid}[${i}] 文案长度 ${ln.text ? ln.text.length : 0} 不在 3~40 字`);
    ok(!/——|--/.test(ln.text), `${nid}[${i}] 含破折号，TTS 不会读`);
    ok(!/[\/／]/.test(ln.text), `${nid}[${i}] 含斜杠`);
    ok(!/[0-9]/.test(ln.text), `${nid}[${i}] 含阿拉伯数字`);
    ok(/^assets[0-9]*\//.test(ln.file) && ln.file.endsWith(`/${nid}/${i}.mp3`),
      `${nid}[${i}] 文件名不符合 <分包>/<nodeId>/<序号>.mp3：${ln.file}`);
    const p = path.join(MP, ln.file);
    if (!fs.existsSync(p)) {
      nodeProblems.push(`${nid}[${i}] 缺音频文件 ${ln.file}`);
      fails++;
      return;
    }
    const buf = fs.readFileSync(p);
    const real = mp3Duration(buf);
    const drift = Math.abs(real - ln.dur);
    if (drift > 0.1) {
      nodeProblems.push(`${nid}[${i}] 音频实测 ${real.toFixed(2)}s，narration.js 记 ${ln.dur}s，差 ${drift.toFixed(2)}s`);
      fails++;
    }
  });
  const last = n.lines[n.lines.length - 1];
  ok(n.total >= last.t + last.dur, `${nid} total 没覆盖最后一句`);
  ok(n.total - (last.t + last.dur) <= 2.5, `${nid} 结尾空等太久`);
});
if (nodeProblems.length) {
  console.log('per-node 音频与时间轴不符：');
  nodeProblems.forEach((p) => console.log('  · ' + p));
}

/* 8. 概念卡云端语音：时间轴必须来自 mp3 实测时长，文案必须与索引的字数指纹一致 */
console.log('\n==== 概念卡云端语音（按 nodeId，走云存储）====');
const { CONCEPT_AUDIO } = require(path.join(MP, 'utils/anim/narration_concept.js'));
const conceptIds = Object.keys(CONCEPT_AUDIO);
let conceptLines = 0;
let conceptRealDur = 0;
const conceptProblems = [];

conceptIds.forEach((nid) => {
  const node = nodes.find((x) => x.id === nid);
  if (!node) { ok(false, `${nid} 在 content.js 里不存在`); return; }
  const r = resolveAnim(node);
  ok(r.scene === 'conceptCard', `${nid} 已不是概念卡（现在是 ${r.scene}），索引里该删掉`);
  const nar = narrationForScene(nid, r.scene, r.data, node);
  const a = CONCEPT_AUDIO[nid];
  ok(nar.lines.length === 5, `${nid} 概念卡应为 5 句，实际 ${nar.lines.length}`);
  ok(a.d.length === nar.lines.length, `${nid} 索引 ${a.d.length} 句 ≠ 实际 ${nar.lines.length} 句`);

  let prevEnd = -1;
  nar.lines.forEach((ln, i) => {
    conceptLines++;
    if (ln.dur !== a.d[i]) {
      conceptProblems.push(`${nid}[${i}] 时间轴没用实测时长（${ln.dur} vs ${a.d[i]}）—— 字数指纹可能已失配`);
      fails++;
    }
    conceptRealDur += ln.dur;
    ok(ln.t >= prevEnd - 0.001, `${nid}[${i}] 与上一句重叠`);
    prevEnd = ln.t + ln.dur;
    ok(ln.file === '', `${nid}[${i}] file 应为空串（等 audioCache 下载后回填，不能写死路径）`);
    ok(!/——|--/.test(ln.text), `${nid}[${i}] 含破折号`);
    ok(!/[\/／]/.test(ln.text), `${nid}[${i}] 含斜杠`);
    ok(!/[0-9０-９]/.test(ln.text), `${nid}[${i}] 含阿拉伯数字：${ln.text}`);
    ok(!/[×÷＞＜＝%％]/.test(ln.text), `${nid}[${i}] 含未转读法的数学符号：${ln.text}`);
    ok(ln.text.length >= 6 && ln.text.length <= 48, `${nid}[${i}] 文案长度 ${ln.text.length} 不在 6~48 字`);
  });
  ok(nar.total >= prevEnd - 0.01, `${nid} total ${nar.total} 没覆盖最后一句 ${prevEnd.toFixed(2)}`);
});
if (conceptProblems.length) {
  console.log('概念卡时间轴异常：');
  conceptProblems.slice(0, 10).forEach((p) => console.log('  · ' + p));
}
console.log(`  概念卡 ${conceptIds.length} 个节点 / ${conceptLines} 句，语音总时长 ${(conceptRealDur / 60).toFixed(1)} 分钟`);

console.log(`\n==== 结果 ====`);
if (problems.length) {
  console.log('音频与时间轴不符：');
  problems.forEach((p) => console.log('  · ' + p));
}
if (fails) {
  console.log(`\n❌ ${fails} 处问题`);
  process.exit(1);
}
console.log(`✅ 场景旁白 ${sceneIds.length} 个 / ${totalLines} 句；per-node 旁白 ${nodeIds.length} 个节点 / ${nodeLines} 句；概念卡 ${conceptIds.length} 个 / ${conceptLines} 句；全部对齐`);
