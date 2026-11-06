// utils/anim/player.js —— 动画播放器：画面 / 字幕 / 语音 三条轨对齐
//
// 分工：
//   engine.js  给定时间 t 画一帧（纯渲染）
//   player.js  管时间、管切句、管音频调度（不含 wx / DOM，两端共用）
//   页面       提供 canvas 上下文、音频适配器、字幕回调
//
// 时钟为什么以画面为主、音频跟着触发，而不是反过来追音频时间：
//   innerAudioContext 的 onTimeUpdate 是 250ms 一次，拿它当主时钟画面会一顿一顿。
//   所以时钟自己走，每句音频独立播放 —— 每句单独起播，误差不会跨句累积。
//   代价是极端卡顿时可能出现半句被截断，比整段错位好接受得多。
//
// 句与句之间有 GAP（生成时留的 0.18 秒），这段时间没有任何一句在讲，
// 字幕保持上一句不闪，让眼睛有个停留。

const { narrationOf } = require('./narration.js');

/** t 时刻在讲第几句；落在句间隙时返回 -1 */
function indexAt(lines, t) {
  if (!lines) return -1;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (t >= ln.t && t < ln.t + ln.dur) return i;
  }
  return -1;
}

/**
 * @param {object} opt
 *   sceneId    场景 id
 *   draw(t)    画一帧（页面里通常就是 drawFrame(ctx, W, H, t, sceneId)）
 *   audio      { play(file), stop() }  —— 可以为 null，表示只有字幕没有声音
 *   resolve    (file) => 实际可播放路径
 *   onLine     (idx, line, prevIdx) 切句回调，idx 为 -1 表示进入句间隙
 *   onTick     (t, ratio) 每帧回调，ratio ∈ [0,1]，给进度条用
 *   onEnd      播完回调
 *   raf/cancelRaf  时钟实现，小程序传 canvas 的，浏览器传 window 的
 */
function createPlayer(opt) {
  // narration 直接由页面算好后传进来（含 lines/total）：
  //   · 7 旗舰节点 = 预打包 mp3 旁白（lines 带 file）
  //   · 其余节点 = 自动生成字幕（lines 无 file，纯字幕播放，不阻塞）
  const narration = opt.narration || null;
  const raf = opt.raf;
  const cancelRaf = opt.cancelRaf;
  const draw = opt.draw;
  const audio = opt.audio || null;
  const resolve = opt.resolve || ((f) => f);

  const total = narration ? narration.total : 0;
  const lines = narration ? narration.lines : [];

  let t = 0;
  let playing = false;
  let rafId = 0;
  let last = 0;        // 上一次 rAF 的时间戳，用来积分增量
  let lineIdx = -1;
  let ended = false;

  function emitLine(idx) {
    if (idx === lineIdx) return;
    const prev = lineIdx;
    lineIdx = idx;
    if (opt.onLine) {
      // 句间隙不切字幕（indexAt 返回 -1），保持上一句显示，避免闪一下
      opt.onLine(idx, idx >= 0 ? lines[idx] : null, prev);
    }
    // 只有带 file 的行才触发语音；字幕-only 行（无 file）跳过音频
    if (idx >= 0 && audio && lines[idx] && lines[idx].file) audio.play(resolve(lines[idx].file), idx);
  }

  function frame(now) {
    if (!playing) return;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    // 单帧最多推进 0.2 秒：切后台回前台时时间戳会跳很大，不夹住会直接跳到结尾
    t += Math.min(dt, 0.2);

    if (t >= total) {
      t = total;
      draw(t);
      if (opt.onTick) opt.onTick(t, 1);
      stopAudio();
      playing = false;
      ended = true;
      if (opt.onEnd) opt.onEnd();
      return;
    }

    draw(t);
    emitLine(indexAt(lines, t));
    if (opt.onTick) opt.onTick(t, t / total);
    rafId = raf(frame);
  }

  function stopAudio() {
    if (audio) audio.stop();
  }

  return {
    total,
    lines,

    /** 从 0 开始播（或从暂停处继续） */
    play() {
      if (playing || !total) return;
      if (ended) { t = 0; ended = false; lineIdx = -1; draw(0); }
      playing = true;
      last = 0;
      // 从暂停处继续时，如果停在某句中间，得把这句补上 ——
      // 否则切句回调不触发，画面在动但一直没声音，用户会以为坏了
      const idx = indexAt(lines, t);
      if (idx >= 0) { lineIdx = idx - 1; emitLine(idx); }
      rafId = raf(frame);
    },

    pause() {
      playing = false;
      if (rafId) cancelRaf(rafId);
      rafId = 0;
      stopAudio();
    },

    /** 回到开头，音频也回开头 */
    replay() {
      this.pause();
      t = 0;
      ended = false;
      lineIdx = -1;
      draw(0);
      if (opt.onTick) opt.onTick(0, 0);
      if (opt.onLine) opt.onLine(-1, null, -1);
    },

    /** 跳到某个时刻（拖动进度条用）。音频不 seek，只把当前句补上 */
    seek(to) {
      t = Math.max(0, Math.min(to, total));
      ended = false;
      draw(t);
      const idx = indexAt(lines, t);
      lineIdx = -2;  // 强制重新触发一次切句
      emitLine(idx);
      if (opt.onTick) opt.onTick(t, total ? t / total : 0);
    },

    /** 只画一帧不播（初始化、切册、截图定格用）。字幕要跟着走，否则定格画面和字幕对不上 */
    renderAt(to) {
      t = Math.max(0, Math.min(to || 0, total));
      draw(t);
      const idx = indexAt(lines, t);
      if (opt.onLine) opt.onLine(idx, idx >= 0 ? lines[idx] : null, -1);
      lineIdx = idx;
      if (opt.onTick) opt.onTick(t, total ? t / total : 0);
    },

    destroy() {
      this.pause();
      if (audio && audio.destroy) audio.destroy();
    },

    get t() { return t; },
    get playing() { return playing; },
    get ended() { return ended; },
    get lineIndex() { return lineIdx; }
  };
}

module.exports = { createPlayer, indexAt };
