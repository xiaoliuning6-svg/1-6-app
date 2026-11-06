#!/usr/bin/env node
/**
 * build_anim_demo.js —— 把小程序里的动画引擎打包成一个可以直接双击打开的预览页
 *
 * 为什么这么做：本机没有微信开发者工具，改完动画无处可看。
 * 这里把 miniprogram/utils/anim/ 下的源码**原样内联**进 HTML，
 * 用同一个 canvas 2d 接口渲染、同一个 player.js 走时钟、同一份 mp3 出声 ——
 * 浏览器里看到听到的和小程序里跑的是同一套东西，不是另写的演示。
 * 改引擎不用改这里，重跑本脚本即可。
 *
 * 同时把对应知识点的真实小故事、易错点、第一道题也内联进来，
 * 让预览页尽量接近真实讲解页的样子（不是只有一块动画）。
 *
 * 用法：node tools/build_anim_demo.js
 * 产物：_preview/anim_demo.html
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');
const OUT = path.join(ROOT, '_preview');

const read = (p) => fs.readFileSync(path.join(MP, p), 'utf8');
const scenesSrc = read('utils/anim/scenes.js');
const engineSrc = read('utils/anim/engine.js');
const narrSrc = read('utils/anim/narration.js');
const playerSrc = read('utils/anim/player.js');
const mapSrc = read('utils/anim/map.js');
const extractSrc = read('utils/anim/extract.js');
const autoMapSrc = read('utils/anim/autoMap.js');
const num2cnSrc = read('utils/anim/num2cn.js');
const kpSrc = read('utils/anim/narration_kp.js');
const nodesSrc = read('utils/anim/narration_nodes.js');
const textSrc = read('utils/anim/text.js');
const conceptSrc = read('utils/anim/narration_concept.js');
const content = require(path.join(MP, 'data', 'content.js'));

/* 每个场景配一个真实知识点，用于展示「动画 + 故事 + 题目」在同一页里的样子 */
const SCENE_NODE = {
  addMeaning: 'bsd-g1s-010',
  makeTen: 'bsd-g1x-004',
  perimeter: 'bsd-g3x-015',
  fractionAdd: 'bsd-g5x-013',
  // 概念卡用真实节点压测：story 有列表、要点会被 pickRaw 截到 18 字，
  // 用默认演示数据测不出「18 字折行会不会压到易错块」。
  conceptCard: 'bsd-g6x-010'
};

/* 参数化之后，动画的**主路径**是「真实题目数据驱动」，不是内置演示值。
   预览页如果只喂 undefined，等于把 58 个运算节点的真实数据路径全放过 ——
   这里按场景算出对应节点的 data，画布才会跟小程序里一模一样。 */
const { resolveAnim } = require(path.join(MP, 'utils/anim/map.js'));
const sceneData = {};
const sceneNodes = {};
Object.entries(SCENE_NODE).forEach(([sid, nid]) => {
  const n = content.nodes.find((x) => x.id === nid);
  if (!n) return;
  const r = resolveAnim(n);
  if (r.data !== undefined) sceneData[sid] = r.data;   // undefined 才是「用演示值」
  sceneNodes[sid] = { id: n.id, title: n.title, story: n.story, wrongTip: n.wrongTip };
});

const LEVEL_TEXT = { Q1: '基础', Q2: '中档', Q3: '变式', Q4: '挑战' };
const TYPE_TEXT = { fill: '填空', choice: '选择', judge: '判断', solve: '解答' };

const demo = {};
Object.entries(SCENE_NODE).forEach(([sceneId, nodeId]) => {
  const n = content.nodes.find((x) => x.id === nodeId);
  if (!n) return;
  const q = n.questions[0];
  demo[sceneId] = {
    nodeTitle: n.title,
    story: n.storyHtml,
    tip: n.wrongTip,
    q: q
      ? {
        stem: q.stem,
        level: LEVEL_TEXT[q.level] || q.level,
        type: TYPE_TEXT[q.type] || q.type,
        answer: q.answer,
        analysis: q.analysis
      }
      : null
  };
});

/* 迷你 CommonJS：把模块按依赖顺序装进 __m，require 路径做最简映射。
   顺序有意义 —— __def 是立即执行的，require 到的模块必须已经注册。 */
const boot = `
const __m = {};
function __def(name, fn) {
  const module = { exports: {} };
  fn(module, module.exports, (p) => __m[p.replace(/^\\.\\//, '').replace(/\\.js$/, '')]);
  __m[name] = module.exports;
}
__def('extract', function (module, exports, require) { ${extractSrc}
});
__def('autoMap', function (module, exports, require) { ${autoMapSrc}
});
__def('num2cn', function (module, exports, require) { ${num2cnSrc}
});
__def('text', function (module, exports, require) { ${textSrc}
});
__def('narration_concept', function (module, exports, require) { ${conceptSrc}
});
__def('narration_kp', function (module, exports, require) { ${kpSrc}
});
__def('narration_nodes', function (module, exports, require) { ${nodesSrc}
});
__def('scenes', function (module, exports, require) { ${scenesSrc}
});
__def('narration', function (module, exports, require) { ${narrSrc}
});
__def('engine', function (module, exports, require) { ${engineSrc}
});
__def('player', function (module, exports, require) { ${playerSrc}
});
__def('map', function (module, exports, require) { ${mapSrc}
});
`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>动画讲解预览 · 数学跟课练</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #eef1f0; color: #1a1a1a; padding: 20px;
    display: flex; justify-content: center;
  }
  .phone { width: 375px; background: #f2f4f3; border-radius: 22px; box-shadow: 0 8px 30px rgba(0,0,0,.12); overflow: hidden; }
  .head { padding: 13px 16px; background: #07c160; color: #fff; font-size: 15px; font-weight: 600; }
  .card { margin: 12px; padding: 14px; background: #fff; border-radius: 12px; }
  .card-head { display: flex; align-items: center; justify-content: space-between; }
  .card-head .t { font-size: 17px; font-weight: 600; }
  .card-head .sub { flex: 1; margin-left: 8px; font-size: 11px; color: #bbb; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .card-head .dur { font-size: 11px; color: #07c160; white-space: nowrap; }
  canvas { width: 100%; height: 240px; display: block; margin-top: 10px; border: 1px solid #eef1ef; border-radius: 7px; background: #fff; }
  .subtitle {
    min-height: 34px; margin-top: 7px; padding: 0 6px;
    font-size: 14px; line-height: 1.55; text-align: center; color: #9aa09c;
    transition: color .15s;
  }
  .subtitle.on { color: #2b302d; }
  .bar { height: 3px; margin: 9px 1px 0; background: #eef1ef; border-radius: 3px; overflow: hidden; }
  .bar > i { display: block; height: 100%; width: 0; background: #07c160; }
  .btns { display: flex; align-items: center; margin-top: 8px; }
  .audio-tag { flex: 1; font-size: 11px; color: #c2c7c4; }
  .audio-tag.on { color: #07c160; }
  .btn { margin-left: 8px; padding: 6px 20px; font-size: 13px; color: #fff; background: #07c160; border-radius: 999px; border: 0; cursor: pointer; }
  .btn.ghost { color: #07c160; background: #fff; border: 1px solid #07c160; }
  .story { margin-top: 10px; font-size: 14px; line-height: 1.85; color: #333; }
  .story b { color: #07c160; }
  .tip { margin-top: 10px; padding: 8px 10px; font-size: 12px; color: #8a6d3b; background: #fdf6e3; border-radius: 7px; line-height: 1.7; }
  .qhead { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #999; }
  .qno { width: 18px; height: 18px; line-height: 18px; text-align: center; font-size: 11px; color: #fff; background: #07c160; border-radius: 50%; }
  .tag { padding: 1px 7px; font-size: 11px; color: #666; background: #f2f4f3; border-radius: 999px; }
  .stem { margin-top: 8px; font-size: 14px; line-height: 1.7; }
  .reveal { margin-top: 10px; padding: 8px; text-align: center; font-size: 13px; color: #07c160; background: #f2fbf6; border: 1px solid #cdeedd; border-radius: 8px; cursor: pointer; }
  .answer { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e6e9e7; font-size: 13px; line-height: 1.7; display: none; }
  .answer .k { display: inline-block; margin-right: 6px; padding: 1px 8px; font-size: 11px; color: #fff; background: #07c160; border-radius: 999px; }
  .answer .a { font-weight: 600; color: #07c160; }
  .list { padding: 0 12px 4px; }
  .lab { font-size: 11px; color: #999; margin: 4px 0 8px; }
  .chip { display: inline-block; margin: 0 6px 6px 0; padding: 7px 12px; font-size: 12px; color: #444; background: #fff; border: 1px solid #e4e8e6; border-radius: 999px; cursor: pointer; }
  .chip.on { color: #fff; background: #07c160; border-color: #07c160; }
  .note { margin: 0 12px 16px; font-size: 11px; color: #999; line-height: 1.75; }
  #err { margin: 0 12px 12px; padding: 8px; font-size: 12px; color: #c00; background: #fdecea; border-radius: 6px; display: none; white-space: pre-wrap; }
</style>
</head>
<body>
<div class="phone">
  <div class="head">讲解 · 预览</div>

  <div class="card">
    <div class="card-head">
      <span class="t">动画讲解</span>
      <span class="sub" id="sub"></span>
      <span class="dur" id="dur"></span>
    </div>
    <canvas id="cv"></canvas>
    <div class="subtitle" id="subtitle">　</div>
    <div class="bar"><i id="pg"></i></div>
    <div class="btns">
      <span class="audio-tag" id="audiotag">语音讲解</span>
      <button class="btn ghost" id="replay">重播</button>
      <button class="btn" id="toggle">播放</button>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><span class="t">小故事</span></div>
    <div class="story" id="story"></div>
    <div class="tip" id="tip"></div>
  </div>

  <div class="card">
    <div class="qhead"><span class="qno">1</span><span id="qlevel" class="tag"></span><span id="qtype" class="tag"></span></div>
    <div class="stem" id="stem"></div>
    <div class="reveal" id="reveal">看答案</div>
    <div class="answer" id="ans">
      <span class="k">答案</span><span class="a" id="atext"></span>
      <div id="ana" style="margin-top:6px;color:#666"></div>
    </div>
  </div>

  <div class="list">
    <div class="lab">切换知识点（一个场景模板可以讲一整类知识点）</div>
    <div id="chips"></div>
  </div>

  <div id="err"></div>

  <div class="note">
    浏览器预览用的是小程序里同一份代码：engine.js 画帧、player.js 走时钟和切句、
    narration.js 提供旁白时间轴、assets/audio 下是同一批 mp3。
    真机上唯一不同的是音频由 innerAudioContext 播，不是 Audio 对象。
  </div>
</div>

<script>
const DEMO = ${JSON.stringify(demo)};
const SCENE_DATA = ${JSON.stringify(sceneData)};
const SCENE_NODES = ${JSON.stringify(sceneNodes)};
${boot}

const E = __m.engine;
const PL = __m.player;
const NR = __m.narration;
const KP = __m.narration_kp;

/* 统一旁白解析：旗舰 4 个场景有 per-scene 预打包旁白；其余场景用 genNarration
   按场景默认数据生成时间轴。不这么做的话非旗舰场景 cue 全塌到 0，
   画面会「一步全出」，演示页和逐帧校验都会失真。 */
function narrFor(id) {
  const node = SCENE_NODES[id];
  if (node) return E.narrationForScene(node.id, id, SCENE_DATA[id], node);
  return NR.narrationOf(id) || KP.genNarration(id, undefined, undefined);
}

const AUDIO_BASE = '../miniprogram/assets/audio/';

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const subEl = document.getElementById('sub');
const durEl = document.getElementById('dur');
const pgEl = document.getElementById('pg');
const subTitleEl = document.getElementById('subtitle');
const audioTagEl = document.getElementById('audiotag');
const toggleEl = document.getElementById('toggle');
const errEl = document.getElementById('err');

let W = 0, H = 0;
function fit() {
  const dpr = window.devicePixelRatio || 1;
  W = cv.clientWidth;
  H = cv.clientHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}
fit();

/* 浏览器音频适配器：按文件缓存 Audio 对象，重复播放零加载延迟 */
const audios = {};
let audioBroken = 0;
window.__audioLog = [];   // 每次起播记一条，供自检脚本断言「第 i 句喊的就是第 i 个文件」
const audioKit = {
  play(file, idx) {
    window.__audioLog.push({ scene: cur, idx: idx, file: file, at: performance.now() });
    let a = audios[file];
    if (!a) {
      a = new Audio(file);
      a.preload = 'auto';
      a.addEventListener('error', () => { audioBroken++; });
      audios[file] = a;
    }
    try { a.currentTime = 0; } catch (e) { /* 还没 metadata */ }
    const p = a.play();
    if (p && p.catch) p.catch(() => { audioBroken++; });
  },
  stop() {
    Object.keys(audios).forEach((k) => {
      try { audios[k].pause(); audios[k].currentTime = 0; } catch (e) { /* 忽略 */ }
    });
  }
};

const ids = Object.keys(E.SCENES);
let cur = ids[0];
let player = null;

const chips = document.getElementById('chips');
ids.forEach((id) => {
  const b = document.createElement('span');
  b.className = 'chip' + (id === cur ? ' on' : '');
  b.textContent = E.SCENES[id].title;
  b.dataset.id = id;
  b.onclick = () => setScene(id, true);
  chips.appendChild(b);
});

function setScene(id, autoplay) {
  if (!E.has(id)) return;
  if (player) player.destroy();
  cur = id;
  [...chips.children].forEach((c) => c.classList.toggle('on', c.dataset.id === id));
  subEl.textContent = E.SCENES[id].title;
  const n = narrFor(id);
  const hasAudio = !!(n && n.lines.some((l) => l.file));
  durEl.textContent = (n ? n.total : E.duration(id)).toFixed(1) + ' 秒';
  subTitleEl.textContent = '　';
  subTitleEl.classList.remove('on');

  audioTagEl.textContent = hasAudio ? (n.lines.length + ' 句语音讲解') : '字幕模式';
  audioTagEl.className = 'audio-tag' + (hasAudio ? ' on' : '');

  player = PL.createPlayer({
    narration: n,
    draw: (t) => E.drawFrame(ctx, W, H, t, id, SCENE_DATA[id], n),
    // 只有带 mp3 的场景才接音频；纯字幕场景 audio=null，避免请求不存在的文件
    audio: hasAudio ? audioKit : null,
    resolve: (f) => AUDIO_BASE + f,
    raf: (fn) => window.requestAnimationFrame(fn),
    cancelRaf: (h) => window.cancelAnimationFrame(h),
    onLine: (idx, line) => {
      // 句间隙（idx=-1）时保留上一句文字，不要清空 —— 清空会闪
      if (line) {
        subTitleEl.textContent = line.text;
        subTitleEl.classList.add('on');
      }
    },
    onTick: (t, ratio) => { pgEl.style.width = (ratio * 100).toFixed(1) + '%'; },
    onEnd: () => { toggleEl.textContent = '播放'; }
  });
  player.renderAt(0);

  const d = DEMO[id];
  if (d) {
    document.getElementById('story').innerHTML = d.story || '';
    document.getElementById('tip').textContent = '易错点：' + (d.tip || '');
    if (d.q) {
      document.getElementById('stem').textContent = d.q.stem;
      document.getElementById('qlevel').textContent = d.q.level;
      document.getElementById('qtype').textContent = d.q.type;
      document.getElementById('atext').textContent = d.q.answer;
      document.getElementById('ana').textContent = d.q.analysis;
    }
    document.getElementById('ans').style.display = 'none';
  }

  toggleEl.textContent = '播放';
  if (autoplay) {
    // 浏览器要求用户交互后才允许出声，自动播只在已交互过的页面上生效
    toggleEl.textContent = '暂停';
    player.play();
  }
}
setScene(cur, false);

document.getElementById('reveal').onclick = () => {
  document.getElementById('ans').style.display = 'block';
};

toggleEl.onclick = () => {
  if (!player) return;
  if (player.playing) player.pause();
  else player.play();
  toggleEl.textContent = player.playing ? '暂停' : '播放';
};
document.getElementById('replay').onclick = () => {
  if (!player) return;
  player.replay();
  player.play();
  toggleEl.textContent = '暂停';
};

/* ---------- 自检脚本用的钩子 ---------- */
window.__sceneIds = ids;
window.__setScene = setScene;

/**
 * 用任意 data 渲染一帧。批量抽查排版用 —— 每个概念卡的文本长度都不一样，
 * 只测一个节点无法发现「某个节点 18 字正好折行压到易错块」这类问题。
 */
window.__drawWith = (sceneId, data, t, narration) => {
  if (!E.has(sceneId)) return false;
  E.drawFrame(ctx, W, H, t || 0, sceneId, data, narration || null);
  return true;
};

/** 定格在某一秒（不播声音），用于逐帧截图断言 */
window.__pose = (id, sec) => {
  setScene(id, false);
  const t = Math.max(0, Math.min(sec, player.total));
  player.pause();
  player.renderAt(t);
  toggleEl.textContent = '播放';
  return player.total;
};

/** 跳到第 i 句旁白的中间时刻，用于断言「说到这句时画面应该长什么样」 */
window.__poseAtLine = (id, lineIdx) => {
  const n = narrFor(id);
  if (!n || !n.lines[lineIdx]) return -1;
  const ln = n.lines[lineIdx];
  return window.__pose(id, ln.t + ln.dur * 0.6);
};

window.__narration = {};
ids.forEach((id) => { window.__narration[id] = narrFor(id); });
window.__audioErrors = () => audioBroken;

window.__errs = [];
window.onerror = (m) => {
  window.__errs.push(String(m));
  errEl.style.display = 'block';
  errEl.textContent = window.__errs.join('\\n');
};
</script>
</body>
</html>
`;

fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, 'anim_demo.html');
fs.writeFileSync(file, html, 'utf8');
const sceneCount = Object.keys(require(path.join(MP, 'utils/anim/scenes.js'))).length;
console.log(`已生成 ${file}`);
console.log(`场景 ${sceneCount} 个，配了真实知识点 ${Object.keys(demo).length} 个`);
