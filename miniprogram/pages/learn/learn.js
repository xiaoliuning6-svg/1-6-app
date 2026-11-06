// pages/learn/learn.js —— 学习页，两种模式：
//   mode=teach     讲解模式：故事大字展示 + 逐题「看答案」揭示（老师投屏用，不算分、不写库）
//   mode=practice  练习模式：作答 + 自动批改 + 解析；解答题对照参考答案自评
// 内容全部来自包内 data/content.js；云端仅记录成绩（失败不影响作答）。
const { nodes } = require('../../data/content.js');
const { call } = require('../../utils/cloud.js');
const anim = require('../../utils/anim/engine.js');
const { resolveAnim } = require('../../utils/anim/map.js');
const { createPlayer } = require('../../utils/anim/player.js');
const { subpackageOf } = require('../../utils/anim/narration_nodes.js');
const audioCache = require('../../utils/anim/audioCache.js');

const MODE_TITLE = { teach: '讲解', practice: '练习' };
const LEVEL_TEXT = { Q1: '基础', Q2: '中档', Q3: '变式', Q4: '挑战' };
const TYPE_TEXT = { fill: '填空', choice: '选择', judge: '判断', solve: '解答' };

/**
 * 音频池。每句旁白一个 innerAudioContext，不共用一个：
 *   共用的话每换一句都要重设 src，重新打开文件，句首能听到半拍空白；
 *   分开之后第二遍播放音频已经解码过，起播几乎无延迟。
 * 全场景最多 5 句，池子很小，不用担心内存。
 */
function createAudioKit() {
  const pool = [];
  const usable = () => typeof wx !== 'undefined' && !!wx.createInnerAudioContext;
  const get = (i) => {
    if (!usable()) return null;
    if (!pool[i]) {
      const a = wx.createInnerAudioContext();
      // 教室里手机常年开静音，跟着静音键走等于讲解没声 —— 这里必须忽略静音键
      a.obeyMuteSwitch = false;
      a.onError(() => { /* 分包没下下来或解码失败：静默降级，字幕照常 */ });
      pool[i] = a;
    }
    return pool[i];
  };
  return {
    play(file, idx) {
      const a = get(idx || 0);
      if (!a) return;
      try {
        a.stop();
        a.src = file;
        a.play();
      } catch (e) { /* 播放失败不影响画面 */ }
    },
    stop() {
      pool.forEach((a) => { try { a.stop(); } catch (e) { /* 忽略 */ } });
    },
    destroy() {
      pool.forEach((a) => { try { a.destroy(); } catch (e) { /* 忽略 */ } });
      pool.length = 0;
    }
  };
}

// 填空/解答答案归一化：全角转半角、去空白与句末标点、×÷ 统一
function norm(s) {
  return String(s == null ? '' : s)
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[＝=]/g, '=')
    .replace(/[，,。．.；;：:！!？?、\s]/g, '')
    .trim();
}

Page({
  data: {
    mode: 'practice',
    node: null,
    storyOpen: false,
    submitted: false,
    autoCorrect: 0,   // 自动批改正确的题数
    autoTotal: 0,     // 参与自动批改的题数
    selfTotal: 0,     // 解答题（自评）题数
    selfCorrect: 0,   // 自评判对的题数
    total: 0,
    // 动画讲解（只有带场景的知识点才有，其余知识点整块不出现）
    animId: '',
    animTitle: '',
    animLen: 0,
    animOpen: true,
    playing: false,
    animProgress: 0,
    animLine: '',      // 当前这句旁白的文字（字幕）
    animLineIdx: -1,
    audioOn: false,    // 语音分包是否就绪；false 时只有字幕，功能不受影响
    // 同册翻页：一节讲完直接翻下一节，不用退回列表再滑着找
    prevId: '',
    nextId: '',
    pos: 0,            // 当前是第几节（按整册算，跨单元连续）
    posTotal: 0,       // 本册共几节
    unitPos: 0,        // 在本单元里排第几
    unitTotal: 0       // 本单元共几节
  },

  onLoad(options) {
    const mode = options.mode === 'teach' ? 'teach' : 'practice';
    const found = nodes.find((n) => n.id === options.id);
    if (!found) {
      wx.showToast({ title: '未找到该知识点', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    const node = JSON.parse(JSON.stringify(found));
    node.questions = node.questions.map((q) => {
      const item = Object.assign({}, q, {
        selected: '',
        reveal: false,     // 讲解模式是否已揭示答案
        judged: '',        // practice: 'ok' | 'no' | ''
        selfMark: '',      // solve 自评：'ok' | 'no' | ''
        levelText: LEVEL_TEXT[q.level] || q.level,
        typeText: TYPE_TEXT[q.type] || q.type
      });
      if (q.type === 'choice') {
        item.optList = (q.options || []).map((o) => ({ val: o.charAt(0), text: o }));
      }
      return item;
    });

    const autoQs = node.questions.filter((q) => q.type !== 'solve');
    // 统一解析：7 旗舰→演示数据+预打包语音；其余→真实题目数据驱动运算动画，或概念卡兜底
    const animRes = resolveAnim(node);
    const sceneId = animRes.scene;
    const hasAnim = !!sceneId && anim.has(sceneId);
    // 旁白：旗舰 → per-node 预打包语音 → 概念卡云端语音 → 自动生成字幕
    const narration = hasAnim ? anim.narrationForScene(node.id, sceneId, animRes.data, node) : null;
    // audioOn 表示「语音是否已就绪」而非「该节点是否有语音」：先 false，
    // 分包下载成功 / 云端音频下完后才置 true（UI 由「字幕模式」切到「语音讲解」）
    const audioOn = false;
    // 语音在哪：subpackage = 已在包里（旗舰/运算节点，离线可用）
    //           cloud      = 概念卡，云端按需下载缓存（约 146KB/节）
    //           ''         = 这节没配语音，纯字幕
    const animAudioKind = animRes.audioKind || '';
    const animSubpkg = animRes.legacy ? 'audio' : (subpackageOf(node.id) || 'audio');

    // 同册顺序表（按 order 排，跨单元连续）。翻页只在本册内走，
    // 到了册首/册尾就置灰 —— 从一上最后一节翻到一下，学生会以为「又从头开始了」。
    const siblings = nodes
      .filter((x) => x.book === node.book)
      .sort((a, b) => a.order - b.order);
    const si = siblings.findIndex((x) => x.id === node.id);
    const prev = si > 0 ? siblings[si - 1] : null;
    const next = si >= 0 && si < siblings.length - 1 ? siblings[si + 1] : null;

    // 本单元内的位置。整册序号（3/37）对老师没意义 —— 他要的是「这个单元还剩几节」。
    const sameUnit = siblings.filter((x) => x.unit === node.unit);
    const ui = sameUnit.findIndex((x) => x.id === node.id);

    this.setData({
      mode,
      node,
      storyOpen: mode === 'teach',   // 讲解模式故事默认展开
      autoTotal: autoQs.length,
      selfTotal: node.questions.length - autoQs.length,
      total: node.questions.length,
      animId: hasAnim ? sceneId : '',
      animTitle: hasAnim ? anim.title(sceneId) : '',
      animLen: hasAnim ? anim.duration(sceneId, null, narration) : 0,
      animData: hasAnim ? animRes.data : null,
      animNarration: hasAnim ? narration : null,
      animLegacy: animRes.legacy,
      animHasAudio: animRes.hasAudio,
      animAudioKind: animAudioKind,
      animSubpkg: animSubpkg,
      audioOn: audioOn,
      prevId: prev ? prev.id : '',
      nextId: next ? next.id : '',
      pos: si + 1,
      posTotal: siblings.length,
      unitPos: ui + 1,
      unitTotal: sameUnit.length
    });
    wx.setNavigationBarTitle({ title: `${MODE_TITLE[mode]} · ${node.title}` });

    this.markSeen(node, mode);

    // 讲解模式自动播一次：老师一点进来就有画面，不用再找播放键。
    // 练习模式默认收起 —— 做题时先看动画会变成抄答案。
    if (hasAnim) {
      this._t = 0;
      const auto = mode === 'teach';
      this.setData({ animOpen: auto }, () => {
        if (auto) this.initAnim(true);
      });
    }
  },

  /**
   * 记两条状态，供首页展示：
   *   lastNode  —— 每册各存一条「上次讲到哪」。刻意按册存而不是全局一条：
   *                老师跨年级带班，全局一条会在两个班之间来回跳。
   *   taught    —— 讲解模式进过就算「讲过」。练习模式不写：学生自己刷题，
   *                不代表老师讲过这一节。两件事必须分开记，否则首页的
   *                「已讲 x/y」会虚高，老师按它排课会漏掉没讲的节。
   */
  markSeen(node, mode) {
    try {
      const last = wx.getStorageSync('lastNode') || {};
      last[node.book] = node.id;
      wx.setStorageSync('lastNode', last);

      if (mode === 'teach') {
        const taught = wx.getStorageSync('taught') || {};
        taught[node.id] = 1;
        wx.setStorageSync('taught', taught);
      }
    } catch (e) { /* 存储写失败不影响上课 */ }
  },

  /* ---------- 动画讲解 ---------- */

  // 初始化 canvas 2d。没有 canvas 能力的环境（Node 模拟测试）直接返回，不影响其余流程。
  initAnim(autoplay) {
    if (!this.data.animId) return;
    if (typeof wx === 'undefined' || !wx.createSelectorQuery) return;
    const query = wx.createSelectorQuery().in(this);
    query.select('#animCanvas').fields({ node: true, size: true }).exec((res) => {
      const r = res && res[0];
      if (!r || !r.node) return;            // 折叠状态下 canvas 未渲染，展开时会再调一次
      const canvas = r.node;
      const dpr = this.dpr();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      this._canvas = canvas;
      this._ctx = ctx;
      this._W = r.width;
      this._H = r.height;
      this._mkPlayer();
      this._player.renderAt(this._t || 0);
      // 语音准备与「是否自动播」解耦：练习模式下动画默认收起，学生点开时是
      // initAnim(false)，如果只在自动播的分支里准备音频，这条路径就永远没声音。
      //   · 自动播（讲解模式）：等就绪再开播，否则第一句是哑的
      //   · 手动展开（练习模式）：后台准备，学生点播放时已经好了，不阻塞
      if (this.data.animHasAudio) {
        if (autoplay) this.prepareAudio(() => this.playAnim());
        else this.prepareAudio(() => {});
      } else if (autoplay) {
        this.playAnim();
      }
    });
  },

  dpr() {
    try {
      if (wx.getWindowInfo) return wx.getWindowInfo().pixelRatio || 2;
      if (wx.getSystemInfoSync) return wx.getSystemInfoSync().pixelRatio || 2;
    } catch (e) { /* 取不到就用 2 */ }
    return 2;
  },

  // 建（或重建）播放器。时钟、切句、音频调度都在 player.js，页面只提供画布和回调。
  _mkPlayer() {
    if (this._player) this._player.destroy();
    if (!this._audioKit) this._audioKit = createAudioKit();
    this._pctLast = -1;
    this._player = createPlayer({
      narration: this.data.animNarration,
      draw: (t) => {
        if (this._ctx) anim.drawFrame(this._ctx, this._W, this._H, t, this.data.animId, this.data.animData, this.data.animNarration);
      },
      // 有预打包语音的节点才接音频；纯字幕节点 audio=null，纯字幕播放
      audio: (this.data.animHasAudio && !this._audioFailed) ? this._audioKit : null,
      // per-node 语音的 file 是从 miniprogram 根算起的完整路径（assets1/...）；
      // 旗舰旁白的 file 是相对 assets/audio 的（addMeaning/0.mp3）；
      // 概念卡是下载到 USER_DATA_PATH 的本地文件（wxfile://usr/...），原样用。
      resolve: (f) => {
        if (!f) return '';
        if (/^(wxfile|http|https):\/\//.test(f)) return f;
        return f.indexOf('assets') === 0 ? '/' + f : '/assets/audio/' + f;
      },
      raf: (fn) => (this._canvas && this._canvas.requestAnimationFrame
        ? this._canvas.requestAnimationFrame(fn)
        : setTimeout(() => fn(Date.now()), 16)),
      cancelRaf: (id) => {
        if (this._canvas && this._canvas.cancelAnimationFrame) this._canvas.cancelAnimationFrame(id);
        else clearTimeout(id);
      },
      onLine: (idx, line) => {
        this.setData({ animLine: line ? line.text : '', animLineIdx: idx });
      },
      onTick: (t, ratio) => {
        // 进度条按整数百分比节流，避免每帧 setData
        const pct = Math.round(ratio * 100);
        if (pct !== this._pctLast) {
          this._pctLast = pct;
          this.setData({ animProgress: pct });
        }
      },
      onEnd: () => {
        this._t = 0;
        this.setData({ playing: false, animProgress: 100 });
      }
    });
  },

  /**
   * 等语音就绪再开播。
   * 为什么等：讲解模式一进来就自动播，如果先出声的几百毫秒里音频还没下好，
   * 第一句就是哑的，老师会以为功能坏了。
   * 但最多等 1.5 秒 —— 教室里没网的时候不能让人盯着空白屏幕。
   *
   * 概念卡（云端语音）例外：**不等**。5 个文件要下载，等它必然超时，
   * 不如先播字幕、边播边下，哪个文件到了下一句就带声（见 prefetchCloudAudio）。
   */
  prepareAudio(cb) {
    if (this.data.animAudioKind === 'cloud') {
      this.prefetchCloudAudio();
      return cb();
    }
    if (this._audioReady || this._audioFailed) return cb();
    let called = false;
    const go = (ok) => {
      if (called) return;
      called = true;
      this._audioReady = ok;
      this._audioFailed = !ok;
      if (ok) this.setData({ audioOn: true });
      cb();
    };
    const timer = setTimeout(() => go(false), 1500);
    if (typeof wx === 'undefined' || !wx.loadSubpackage) {
      clearTimeout(timer);
      return go(false);
    }
    // 按节点所属分包加载（旗舰 audio / 运算节点 audio1~audio3），不是固定 audio
    wx.loadSubpackage({
      name: this.data.animSubpkg || 'audio',
      success: () => { clearTimeout(timer); go(true); },
      fail: () => { clearTimeout(timer); go(false); }
    });
  },

  /**
   * 概念卡语音：后台按节下载并回填。
   * 回填的是 narration.lines[i].file —— player 持有同一个数组引用，
   * 所以不需要重建播放器，下一句自然就有声了。
   */
  prefetchCloudAudio() {
    const nar = this.data.animNarration;
    const node = this.data.node;
    if (!nar || !nar.lines || !nar.lines.length || !node || !node.id) return;
    const lines = nar.lines;
    audioCache.ensureFiles(node.id, lines.length, (i, p) => {
      if (!lines[i]) return;
      lines[i].file = p;
      // 补播窗口：这一句**正在播**、且才播了不到 1.2 秒时，立刻从头补上。
      // 少了这段，第一句永远是哑的 —— 学生听到的第一句话就是静音，
      // 会以为功能坏了；播放器只在切句时触发音频，不会为「迟到的文件」回头。
      this.patchCurrentLine(i, p);
    }, (ok) => {
      if (ok) {
        if (!this.data.audioOn) this.setData({ audioOn: true });
      } else {
        this._audioFailed = true;   // 下载失败就安心走字幕，别每句都去试
      }
    });
  },

  patchCurrentLine(i, file) {
    if (!file || !this._audioKit || !this._player || !this.data.playing) return;
    // 用 player 的实时 lineIndex，不用 data.animLineIdx —— 后者是 setData 异步写进去的，
    // 下载往返几百毫秒里可能还停在上一句，会补播错行。
    if (this._player.lineIndex !== i) return;
    const nar = this.data.animNarration;
    const ln = nar && nar.lines && nar.lines[i];
    if (!ln) return;
    const t = this._player.t || 0;
    if (t - ln.t > 1.2) return;      // 播到一半才下载完：不回头重念，免得重复半句
    this._audioKit.play(file, i);
  },

  toggleAnim() {
    const open = !this.data.animOpen;
    this.setData({ animOpen: open }, () => {
      if (open) setTimeout(() => this.initAnim(false), 30); // 等 canvas 渲染出来再量尺寸
    });
  },

  togglePlay() {
    if (this.data.playing) this.pauseAnim();
    else this.playAnim();
  },

  playAnim() {
    if (!this._player || this.data.playing || !this.data.animId) return;
    if (!this._player.total) return;
    this.setData({ playing: true });
    this._player.play();
  },

  pauseAnim() {
    if (this._player) {
      this._player.pause();
      this._t = this._player.t;
    }
    this.setData({ playing: false });
  },

  replayAnim() {
    if (!this._player) return;
    this._player.replay();
    this._pctLast = -1;
    this.setData({ animProgress: 0, playing: false }, () => this.playAnim());
  },

  onHide() {
    // 切后台别继续念，回到前台停在原处
    if (this.data.playing) this.pauseAnim();
  },

  onUnload() {
    if (this._player) {
      this._player.destroy();
      this._player = null;
    }
    if (this._audioKit) {
      this._audioKit.destroy();
      this._audioKit = null;
    }
  },

  toggleStory() {
    this.setData({ storyOpen: !this.data.storyOpen });
  },

  /* ---------- 讲解模式：揭示答案 ---------- */
  reveal(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData({ [`node.questions[${idx}].reveal`]: true });
  },
  revealAll() {
    const qs = this.data.node.questions.map((q) => Object.assign({}, q, { reveal: true }));
    this.setData({ 'node.questions': qs });
  },

  /* ---------- 练习模式：作答 ---------- */
  choose(e) {
    const { idx, val } = e.currentTarget.dataset;
    if (this.data.submitted) return;
    this.setData({ [`node.questions[${idx}].selected`]: val });
  },

  onFill(e) {
    const idx = e.currentTarget.dataset.idx;
    if (this.data.submitted) return;
    this.setData({ [`node.questions[${idx}].selected`]: e.detail.value });
  },

  submit() {
    const { node } = this.data;
    const unanswered = node.questions.filter(
      (q) => q.type !== 'solve' && !String(q.selected || '').trim()
    );
    if (unanswered.length && !this._confirmed) {
      // 二次确认：有未做题，避免误点提交
      this._confirmed = true;
      wx.showModal({
        title: '还有题没做',
        content: `有 ${unanswered.length} 道题没填，仍要提交吗？`,
        confirmText: '提交',
        cancelText: '继续做',
        success: (r) => {
          if (r.confirm) this.submit();
        }
      });
      return;
    }
    this._confirmed = false;

    let autoCorrect = 0;
    const judged = node.questions.map((q) => {
      if (q.type === 'solve') return Object.assign({}, q, { judged: '' });
      const sel = String(q.selected || '').trim();
      let ok = false;
      if (q.type === 'choice' || q.type === 'judge') {
        // 与云函数 submitAnswer 的 judge() 保持同一口径（选择题忽略大小写）
        ok = sel.toUpperCase() === String(q.answer).trim().toUpperCase();
      } else {
        ok = norm(sel) === norm(q.answer);
      }
      if (ok) autoCorrect++;
      return Object.assign({}, q, { judged: ok ? 'ok' : 'no', reveal: true });
    });

    this.setData({
      node: Object.assign({}, node, { questions: judged }),
      submitted: true,
      autoCorrect
    });

    // 本地即时记分（云端失败也不影响老师看到结果）
    this.saveLocal(autoCorrect, this.data.selfCorrect);

    // 云端落库：逐题上传，服务端二次判定（前端判定只用于即时反馈）
    call('submitAnswer', {
      nodeId: node.id,
      book: node.book,
      answers: judged.map((q) => ({
        questionId: q.id,
        no: q.no,
        type: q.type,
        selected: q.selected,
        selfMark: q.selfMark
      }))
    }).catch((err) => {
      // 本机模式属正常降级，不刷日志；真失败才提示
      if (err && err.message === 'LOCAL_MODE') return;
      console.warn('[learn] submitAnswer 失败，成绩已存本机', err);
    });
  },

  /* ---------- 解答题自评 ---------- */
  selfJudge(e) {
    const { idx, mark } = e.currentTarget.dataset;
    const key = `node.questions[${idx}].selfMark`;
    const prev = this.data.node.questions[idx].selfMark;
    if (prev === mark) return;
    const delta = (mark === 'ok' ? 1 : 0) - (prev === 'ok' ? 1 : 0);
    const selfCorrect = Math.max(0, this.data.selfCorrect + delta);
    this.setData({ [key]: mark, selfCorrect });
    // 没提交就写 progress 会造出一条 autoCorrect=0 / autoTotal=N 的假记录，
    // 把正确率凭空拉低；没提交本来也不该算「练过」。错题本仍要记（学生自己说不会）。
    if (this.data.submitted) this.saveLocal(this.data.autoCorrect, selfCorrect);
    else this.saveWrongBook();
  },

  /**
   * 成绩落盘。两套数必须分开存：
   *   autoCorrect / autoTotal   机器判分（填空/选择/判断）—— 可信，正确率只用它
   *   selfCorrect / selfTotal   解答题学生自评 —— 不可信，只单独展示，绝不进正确率
   * 兼容别名 correct/total 保留，但语义改为「只指机器判分」，避免遗漏的旧读点又把自评算进来。
   * v:2 是口径版本；没有 v 的是旧记录（混了自评），报告端会排除并提示重做。
   */
  saveLocal(autoCorrect, selfCorrect) {
    const { node } = this.data;
    const autoTotal = this.data.autoTotal;
    const selfTotal = this.data.selfTotal;
    const a = Math.max(0, autoCorrect || 0);
    const s = Math.max(0, selfCorrect || 0);
    const progress = wx.getStorageSync('progress') || {};
    progress[node.id] = {
      v: 2,
      autoCorrect: a,
      autoTotal,
      selfCorrect: s,
      selfTotal,
      correct: a,     // 兼容别名：只指机器判分题
      total: autoTotal,
      at: Date.now()
    };
    wx.setStorageSync('progress', progress);
    this.saveWrongBook();
  },

  // 错题本（自动判错的 + 自评标「不会」的，都记）
  saveWrongBook() {
    const { node } = this.data;
    const book = wx.getStorageSync('wrongBook') || [];
    node.questions.forEach((q) => {
      const wrong = q.judged === 'no' || q.selfMark === 'no';
      if (!wrong) return;
      const exist = book.find((x) => x.questionId === q.id);
      if (exist) {
        exist.wrongCount = (exist.wrongCount || 1) + 1;
        exist.lastAt = Date.now();
      } else {
        book.push({
          questionId: q.id,
          nodeId: node.id,
          nodeTitle: node.title,
          unit: node.unit,
          book: node.book,
          stem: q.stem,
          answer: q.answer,
          analysis: q.analysis,
          wrongCount: 1,
          lastAt: Date.now()
        });
      }
    });
    wx.setStorageSync('wrongBook', book);
  },

  /* ---------- 同册翻页 ---------- */

  goPrev() { this.goSibling(this.data.prevId); },
  goNext() { this.goSibling(this.data.nextId); },

  /**
   * 翻到同册的上一节/下一节。
   * 用 redirectTo 而不是 navigateTo：一节课连着讲十几节，navigateTo 会堆十几层页面栈
   * （微信上限 10 层，超了直接跳不动），而且返回键要按十几下才回到列表。
   */
  goSibling(id) {
    if (!id) return;
    const url = `/pages/learn/learn?id=${id}&mode=${this.data.mode}`;
    const jump = () => wx.redirectTo({ url });

    // 练习模式写了答案还没提交：翻过去这批作答就没了，先问一句
    if (this.data.mode === 'practice' && !this.data.submitted && this._answered()) {
      wx.showModal({
        title: '还没提交',
        content: '这一节写的答案还没提交，翻过去就丢了。',
        confirmText: '继续翻',
        cancelText: '留在这一节',
        success: (r) => { if (r.confirm) jump(); }
      });
      return;
    }
    jump();
  },

  _answered() {
    const qs = (this.data.node && this.data.node.questions) || [];
    return qs.some((q) => String(q.selected == null ? '' : q.selected).trim());
  },

  back() { wx.navigateBack(); }
});
