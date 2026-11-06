// pages/index/index.js —— 首页：按册 → 单元 → 知识点浏览
// 内容走包内 data/content.js（启动即可用，不依赖云环境）；
// 云端只记录练习/错题/报告（见 cloud.js），无云时自动降级本地存储。
const { books, nodes } = require('../../data/content.js');

// 两列下拉：年级 / 上下册。12 册摊成一列要滚很久，分两列两下就点到任意一册。
const GRADE_CN = ['一', '二', '三', '四', '五', '六'];
const TERM_LIST = ['上册', '下册'];
const termIdx = (t) => (t === '下' ? 1 : 0);

/**
 * 单元索引条上的短名。
 * 「第一单元 混合运算」只留「一」——完整名字太长，一屏排不下 12 个；
 * 没有编号的特殊单元缩成两个字（综合 / 好玩 / 复习），宽度和序号对齐，
 * 不然一条索引条上 1 字和 4 字混排，看着参差。
 */
const SPECIAL_SHORT = { 综合实践: '综合', 数学好玩: '好玩', 总复习: '复习' };

function unitShort(unit) {
  const str = String(unit || '');
  const m = /^第([一二三四五六七八九十]+)单元/.exec(str);
  if (m) return m[1];
  const head = str.split(/\s+/)[0];
  return SPECIAL_SHORT[head] || head;
}

Page({
  data: {
    books: [],
    bookLabels: [],  // 展示文案：`二年级下册 · 39 讲`
    bookRange: [[], []], // picker 两列：年级列 / 上下册列
    bookValue: [0, 0],   // picker 当前选中 [年级下标, 册次下标]
    grades: [],          // 年级数字列表，用于把 grade 映射回列下标
    bookIndex: 0,        // 当前册在 books 里的下标
    bookKey: '',
    groups: [],      // [{ seq, unit, short, nodes: [...] }]
    nodeCount: 0,
    questionCount: 0,
    progress: {},    // nodeId → { correct, total }  练过（提交过练习）
    taught: {},      // nodeId → 1                    讲过（讲解模式进过）
    resume: null,    // 上次讲到的一节 { id, title, pos, total }
    cloudOn: false,
    activeSeq: 0    // 当前单元索引条高亮项
  },

  onLoad() {
    const books4ui = books.map(b => ({
      key: b.key,
      title: b.title,
      grade: b.grade,
      term: b.term,
      count: b.nodeCount
    }));
    const bookLabels = books4ui.map(b => `${b.title} · ${b.count} 讲`);

    // 年级列从数据里取（不写死 1-6），将来增减年级不用改代码
    const grades = [...new Set(books4ui.map(b => b.grade))].sort((a, b) => a - b);
    const bookRange = [
      grades.map(g => `${GRADE_CN[g - 1] || g}年级`), // 一年级…六年级（不加「第」，中文不这么说）
      TERM_LIST
    ];

    // 默认册：优先恢复上次选择（老师常教固定年级），否则取第一册（一年级上册）。
    // 12 册全量后不能取"最后一册"——那是六年级下册，打开就是最难的册。
    let idx = 0;
    const last = wx.getStorageSync('lastBook');
    if (last) {
      const i = books4ui.findIndex(b => b.key === last);
      if (i >= 0) idx = i;
    }
    const cur = books4ui[idx];

    this.setData({
      books: books4ui,
      bookLabels,
      bookRange,
      grades,
      bookIndex: idx,
      bookValue: cur ? [Math.max(grades.indexOf(cur.grade), 0), termIdx(cur.term)] : [0, 0],
      bookKey: cur ? cur.key : '',
      cloudOn: getApp().globalData.cloudOn
    });
  },

  onShow() {
    this.render();
  },

  // 按当前册分组渲染
  render() {
    const { bookKey } = this.data;
    const progress = wx.getStorageSync('progress') || {};
    const taught = wx.getStorageSync('taught') || {};
    const lastMap = wx.getStorageSync('lastNode') || {};
    const list = nodes.filter(n => n.book === bookKey);

    // 按 unitSeq 保序分组（综合实践/数学好玩也按教材出现位置排）
    const map = new Map();
    list.forEach(n => {
      if (!map.has(n.unit)) map.set(n.unit, { unit: n.unit, seq: n.unitSeq, nodes: [], taughtCount: 0 });
      const p = progress[n.id];
      const seen = !!taught[n.id];
      const g = map.get(n.unit);
      g.nodes.push({
        id: n.id,
        order: n.order,
        title: n.title,
        qCount: n.questions.length,
        done: !!p,
        seen,
        // 三态：练过（绿）/ 只讲过（蓝）/ 没动过（灰）
        state: p ? 'done' : (seen ? 'taught' : ''),
        // 只显示机器判分题的分数。旧记录（无 v:2）混了自评，宁可不给数字。
        score: p
          ? (p.v === 2 && p.autoTotal
              ? `上次 ${p.autoCorrect}/${p.autoTotal}`
              : '已练（旧记录）')
          : ''
      });
      if (seen) g.taughtCount += 1;
    });
    const groups = [...map.values()].sort((a, b) => a.seq - b.seq);

    // 上次讲到哪。按当前册取 —— 切到别的册不该还提示上一册的进度。
    const resumeId = lastMap[bookKey];
    let resume = null;
    if (resumeId) {
      const ordered = list.slice().sort((a, b) => a.order - b.order);
      const i = ordered.findIndex(n => n.id === resumeId);
      if (i >= 0) resume = { id: resumeId, title: ordered[i].title, pos: i + 1, total: ordered.length };
    }
    groups.forEach((g) => { g.short = unitShort(g.unit); });
    // 一册里通常有两个「综合实践」，缩成「综合」后分不出来 —— 重名的统一加序号
    const cnt = {};
    groups.forEach((g) => { cnt[g.short] = (cnt[g.short] || 0) + 1; });
    const seen = {};
    groups.forEach((g) => {
      if (cnt[g.short] > 1) {
        seen[g.short] = (seen[g.short] || 0) + 1;
        g.short += seen[g.short];
      }
    });

    // 导航栏标题跟着当前册走。原来是写死在 index.json 的「三年级 · 时、分、秒」，
    // 12 册之后切到哪一册都还是这行字，老师会以为自己选错了册。
    const curBook = this.data.books.find((b) => b.key === bookKey);
    if (curBook) {
      wx.setNavigationBarTitle({ title: `${curBook.title} · ${curBook.count} 讲` });
    }

    this.setData({
      groups,
      nodeCount: list.length,
      questionCount: list.reduce((s, n) => s + n.questions.length, 0),
      progress,
      taught,
      resume
    }, () => this._measureUnits());
  },

  /* ---------- 单元索引：点一下直接滚到那个单元 ---------- */

  jumpUnit(e) {
    const seq = Number(e.currentTarget.dataset.seq);
    if (!seq) return;
    this.setData({ activeSeq: seq });
    // offsetTop 负数 = 滚到元素上方留出吸顶条的高度。
    // 索引条实测约 70px（两行 chip），留 74px 才不会把单元标题正好藏在条下面。
    wx.pageScrollTo({ selector: '#u' + seq, offsetTop: -74, duration: 260 });
  },

  // 量一遍每个单元标题在页面里的绝对位置，滚动时用来判断当前在哪个单元
  _measureUnits() {
    this._unitTop = [];
    if (typeof wx === 'undefined' || !wx.createSelectorQuery) return;
    const q = wx.createSelectorQuery();
    q.selectAll('.unit-head').boundingClientRect();
    q.selectViewport().scrollOffset();
    q.exec((res) => {
      const rects = res && res[0];
      const view = res && res[1];
      if (!rects || !rects.length) return;
      const base = (view && view.scrollTop) || 0;
      this._unitTop = rects.map((r) => r.top + base);
      this._syncActive((view && view.scrollTop) || 0);
    });
  },

  onPageScroll(e) {
    this._syncActive(e.scrollTop || 0);
  },

  // 找出「最后一个已经滚过索引条下沿的单元」，就是当前正在看的单元
  _syncActive(top) {
    const tops = this._unitTop;
    const groups = this.data.groups;
    if (!tops || !tops.length || !groups.length) return;
    let idx = 0;
    for (let i = 0; i < tops.length; i++) {
      if (tops[i] - 60 <= top) idx = i;
    }
    const seq = groups[Math.min(idx, groups.length - 1)].seq;
    if (seq !== this.data.activeSeq) {
      this.setData({ activeSeq: seq });
    }
  },

  // 两列下拉：按 [年级下标, 册次下标] 定位一册
  findBookByPicker(gIdx, tIdx) {
    const grade = this.data.grades[gIdx];
    return this.data.books.find(b => b.grade === grade && termIdx(b.term) === tIdx) || null;
  },

  // 滚轮滚动中：只更新选中位置。若该「年级+册次」组合没有书（某年级缺某册），
  // 就把册次列纠正到这一年级实际有的那册，避免确认后落到空册。
  onColumnChange(e) {
    const column = Number(e.detail.column);
    const value = Number(e.detail.value);
    const next = (this.data.bookValue || [0, 0]).slice();
    next[column] = value;

    if (!this.findBookByPicker(next[0], next[1])) {
      const grade = this.data.grades[next[0]];
      const alt = this.data.books.find(b => b.grade === grade);
      if (alt) next[1] = termIdx(alt.term);
    }
    this.setData({ bookValue: next });
  },

  // 点「确定」：picker 回传的是字符串下标数组，必须转数字再当索引
  onPickBook(e) {
    const v = (e.detail.value || []).map(Number);
    const hit = this.findBookByPicker(v[0], v[1]);
    if (!hit) {
      // 组合不存在（理论上被 onColumnChange 纠正过，这里是兜底）：滚轮弹回当前册
      const cur = this.data.books[this.data.bookIndex];
      if (cur) {
        this.setData({
          bookValue: [Math.max(this.data.grades.indexOf(cur.grade), 0), termIdx(cur.term)]
        });
      }
      return;
    }
    this.setBookAt(this.data.books.indexOf(hit));
  },

  // 兼容旧的标签式切换（外部若有地方按 data-key 调用仍可用）
  switchBook(e) {
    const key = e.currentTarget.dataset.key;
    const idx = this.data.books.findIndex(b => b.key === key);
    if (idx >= 0) this.setBookAt(idx);
  },

  setBookAt(idx) {
    const b = this.data.books[idx];
    if (!b) return;
    const gIdx = this.data.grades.indexOf(b.grade);
    this.setData({
      bookIndex: idx,
      bookKey: b.key,
      bookValue: [gIdx >= 0 ? gIdx : 0, termIdx(b.term)]
    }, () => this.render());
    wx.setStorageSync('lastBook', b.key); // 记住选择，下次进来直接落在这一册
  },

  // mode: practice 学生作答 / teach 投屏讲解
  goLearn(e) {
    const { id, mode } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/learn/learn?id=${id}&mode=${mode || 'practice'}` });
  },

  // 继续上次：直接按讲解模式打开那一节（老师上课的主场景），不用再自己找
  goResume() {
    const r = this.data.resume;
    if (!r) return;
    wx.navigateTo({ url: `/pages/learn/learn?id=${r.id}&mode=teach` });
  },

  goWrong() { wx.navigateTo({ url: '/pages/wrong/wrong' }); },
  goReport() { wx.navigateTo({ url: '/pages/report/report' }); },
  goTeacher() { wx.navigateTo({ url: '/pages/teacher/teacher' }); }
});
