// utils/anim/engine.js —— 动画讲解引擎（纯渲染，不依赖 wx / DOM）
//
// 为什么单独抽一层：同一个场景代码要能跑在两处 ——
//   1) 小程序页面里的 <canvas type="2d">（真机）
//   2) 本机预览（浏览器 canvas），因为本机没有开发者工具，不这么做改完动画就无处可看
// 所以这里只做「给定时间 t，把一帧画出来」，时钟、播放控制交给调用方。
//
// ⚠️ 参数化重构（覆盖 486 知识点）：
//   场景现在接收第五个参数 data —— 真实题目的数字/运算。
//   data 为 undefined 时，场景回退到内置的「演示例题」（保持向后兼容，
//   旧的 7 个知识点即使没配 data 也能正常播）。
//   旁白同理：narrationOf(key) 优先按知识点 id 查，查不到再按场景名查。

const SCENES = require('./scenes.js');
const { narrationOf } = require('./narration.js');
const { narrationNodeOf } = require('./narration_nodes.js');
const { conceptAudioOf } = require('./narration_concept.js');
const { genNarration } = require('./narration_kp.js');

/* 概念卡云端语音的句间停顿，与 tools/gen_concept_audio.py 的 GAP 保持一致 */
const CONCEPT_GAP = 0.18;

/* 7 个旗舰节点：固定场景 + 演示数据 + 预打包语音（教室无网也能放声） */
const LEGACY_NODES = new Set([
  'bsd-g1s-010', 'bsd-g1x-004',
  'bsd-g3x-015', 'bsd-g3x-016', 'bsd-g3x-017', 'bsd-g3x-018',
  'bsd-g5x-013'
]);

/* 色板：和页面主题一致，动效里不要出现别的颜色 */
const C = {
  text: '#1a1a1a',
  sub: '#8a8f8c',
  green: '#07c160',
  greenSoft: '#e8f8ef',
  red: '#f5483b',
  redSoft: '#fdecea',
  blue: '#3b7bf5',
  blueSoft: '#eaf0ff',
  amber: '#f5a623',
  line: '#d9dedb',
  bg: '#ffffff'
};

/* ---------- 缓动 ---------- */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 把时间窗口 [a,b] 映射成 0..1 的进度；窗口外夹紧。t 早于 a 返回 0，晚于 b 返回 1 */
const seg = (t, a, b) => clamp01((t - a) / (b - a || 1));
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const easeIn = (p) => p * p * p;
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const lerp = (a, b, p) => a + (b - a) * p;

/* ---------- 基础绘制 ---------- */
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2);
  ctx.lineTo(x + rr, y + h);
  ctx.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + rr);
  ctx.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

function dot(ctx, cx, cy, r, color, alpha) {
  if (!(r > 0)) return;
  ctx.save();
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function label(ctx, text, x, y, opt) {
  const o = opt || {};
  const size = o.size || 16;
  ctx.save();
  ctx.fillStyle = o.color || C.text;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${o.bold ? 'bold ' : ''}${size}px sans-serif`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* 传给场景的工具集：场景里不直接写死缓动/绘制细节，方便以后统一调手感 */
const u = { C, clamp01, seg, easeOut, easeIn, easeInOut, lerp, roundRect, dot, label };

/* ---------- 按场景注入 cue ---------- */
//
// cue(i) 返回第 i 句旁白的开始时间。场景里的动作节点全部挂在这上面，
// 不再写死秒数 —— 写死的话改一句文案，画面就跟声音错开了。
//
// 每帧都构造一次 u 会有 GC 压力（22 秒 × 60fps ≈ 1300 次），所以按场景缓存。
const uCache = {};

/**
 * @param {string} narrationKey 旁白检索键：优先知识点 id（per-KP 旁白），回退场景名
 */
function cuesFor(id, narrationKey) {
  const cacheKey = narrationKey || id || '';
  if (uCache[cacheKey]) return uCache[cacheKey];
  const n = narrationFor(id, narrationKey);
  const cue = (i) => {
    if (!n || !n.lines[i]) return n ? n.total : 0;
    return n.lines[i].t;
  };
  // cue(i) + 该句时长：给「这句话说完的同时动作刚好停下」这类收尾用
  const cueEnd = (i) => {
    if (!n || !n.lines[i]) return n ? n.total : 0;
    return n.lines[i].t + n.lines[i].dur;
  };
  const uu = Object.assign({}, u, { cue, cueEnd, lines: n ? n.lines : [] });
  uCache[cacheKey] = uu;
  return uu;
}

/* ---------- 旁白检索：per-KP 优先，场景名回退 ---------- */
function narrationFor(id, narrationKey) {
  if (narrationKey && narrationOf(narrationKey)) return narrationOf(narrationKey);
  if (id && narrationOf(id)) return narrationOf(id);
  return null;
}

/* ---------- 逐知识点旁白：旗舰 > per-node 预打包 > 概念卡云语音 > 自动字幕 ---------- */
function narrationForScene(nodeId, scene, data, node) {
  // 1) 旗舰节点：用预打包的 mp3 旁白（数据也是演示值，和语音一致）
  if (nodeId && LEGACY_NODES.has(nodeId) && narrationOf(scene)) {
    return narrationOf(scene);
  }
  // 2) 运算动画节点：已生成逐句预打包语音（按真实题目数据推导的讲解，声画对齐）
  if (nodeId && narrationNodeOf(nodeId)) {
    return narrationNodeOf(nodeId);
  }
  // 3) 概念卡：文案现生成，时间轴换成云端语音的实测时长（若这一节已配语音）。
  //    file 先留空 —— 音频要等 audioCache 下完才回填，这段时间就是纯字幕。
  const auto = genNarration(scene, data, node);
  if (nodeId && scene === 'conceptCard') return withConceptAudio(nodeId, auto);
  return auto;
}

/**
 * 把「按字数估算」的字幕时间轴，换成「云端 mp3 实测时长」的时间轴。
 * 三道闸任一不过就直接返回原字幕（宁可没声，也不要声画错位）：
 *   1. 这一节没有配语音
 *   2. 句数对不上（改了模板加/删句）
 *   3. 字数指纹对不上（改了文案没重跑 TTS）
 */
function withConceptAudio(nodeId, nar) {
  const a = conceptAudioOf(nodeId);
  if (!a || !nar || !nar.lines || !a.d || a.d.length !== nar.lines.length) return nar;
  for (let i = 0; i < a.d.length; i++) {
    if (a.n[i] !== (nar.lines[i].text || '').length) return nar;
  }
  let t = 0;
  const lines = [];
  for (let i = 0; i < nar.lines.length; i++) {
    lines.push({
      t: Math.round(t * 100) / 100,
      dur: a.d[i],
      text: nar.lines[i].text,
      file: ''
    });
    t += a.d[i] + CONCEPT_GAP;
  }
  return { total: a.t || Math.round(t * 100) / 100, lines, __key: 'concept_' + nodeId };
}

/* ---------- 由旁白对象构造 cue：字幕时间轴驱动画面节点 ---------- */
function cuesFrom(narration) {
  const n = narration;
  const cacheKey = n && n.__key;
  if (cacheKey && uCache[cacheKey]) return uCache[cacheKey];
  const cue = (i) => (n && n.lines[i] ? n.lines[i].t : (n ? n.total : 0));
  const cueEnd = (i) => (n && n.lines[i] ? n.lines[i].t + n.lines[i].dur : (n ? n.total : 0));
  const uu = Object.assign({}, u, { cue, cueEnd, lines: n ? n.lines : [] });
  if (cacheKey) uCache[cacheKey] = uu;
  return uu;
}

/* ---------- 对外接口 ---------- */
function getScene(id) {
  return (id && SCENES[id]) || null;
}

/**
 * 场景总时长。有旁白时以旁白为准 —— 画面必须跟着讲解走完，
 * 不能声音还在讲、画面已经停了（或反过来画面空等）。
 */
function duration(id, narrationKey, narration) {
  const s = getScene(id);
  if (!s) return 0;
  if (narration) return narration.total;
  const n = narrationFor(id, narrationKey);
  return n ? n.total : s.duration;
}

function title(id) {
  const s = getScene(id);
  return s ? s.title : '';
}

function has(id) {
  return !!getScene(id);
}

/**
 * 画一帧。t 会被夹到 [0, duration]，所以播放器不必自己处理越界。
 * 背景先铺白，避免上一帧残影（小程序 canvas 不自动清）。
 * @param {string} scene   场景名
 * @param {object} [data]  真实题目数据（可选，缺省走场景内置演示例题）
 * @param {object} [narration] 旁白时间轴（含 lines/total）；传入则用其时间轴驱动 cue
 */
function drawFrame(ctx, W, H, t, scene, data, narration) {
  const s = getScene(scene);
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  if (s) {
    const dur = narration ? narration.total : duration(scene);
    const tt = Math.max(0, Math.min(t, dur));
    const cueU = narration ? cuesFrom(narration) : cuesFor(scene);
    ctx.save();
    s.draw(ctx, W, H, tt, cueU, data);
    ctx.restore();
  }
  ctx.restore();
}

/** 取当前时刻正在讲的那句（给字幕用）；没在讲任何一句时返回 null */
function lineAt(id, t, narrationKey, narration) {
  const n = narration || narrationFor(id, narrationKey);
  if (!n) return null;
  for (let i = 0; i < n.lines.length; i++) {
    const ln = n.lines[i];
    if (t >= ln.t && t < ln.t + ln.dur) return { index: i, line: ln };
  }
  return null;
}

module.exports = { drawFrame, duration, title, has, getScene, lineAt, narrationFor, narrationForScene, cuesFrom, SCENES, C, u };
