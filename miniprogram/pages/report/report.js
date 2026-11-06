// pages/report/report.js —— 学习报告：本机规则版（不依赖云），云端可用时叠加服务端报告
// 规则版设计原则：只讲「哪里错了、下一步做什么」，不堆形容词、不编造归因。
const { nodes } = require('../../data/content.js');
const { call, isCloudOn } = require('../../utils/cloud.js');

function pct(a, b) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

Page({
  data: {
    cloudOn: false,
    stat: null,     // { nodesDone, qTotal, qCorrect, rate, level }
    weak: [],       // 薄弱知识点
    units: [],      // 单元维度
    cloud: null,    // 云端报告（可选）
    empty: true
  },

  onShow() {
    this.build();
  },

  build() {
    const progress = wx.getStorageSync('progress') || {};
    const wrongBook = wx.getStorageSync('wrongBook') || [];
    const cloudOn = isCloudOn();
    const ids = Object.keys(progress);

    if (!ids.length) {
      this.setData({ empty: true, cloudOn });
      return;
    }

    // 口径：正确率只认机器判分（填空/选择/判断）。解答题是学生自己勾「会/不会」，
    // 全勾对就能刷出 100%「扎实」—— 那个数字是假的，必须单独列、不进分母。
    let qTotal = 0;
    let qCorrect = 0;
    let selfTotal = 0;
    let selfCorrect = 0;
    let legacyCount = 0;
    const unitMap = new Map();

    ids.forEach((id) => {
      const p = progress[id] || {};
      const n = nodes.find((x) => x.id === id);
      const unit = n ? n.unit : '其他';

      // 旧记录（没有 v:2）里 correct 混了自评，无法拆开，宁可不计数也不能显示假正确率
      if (p.v !== 2 || typeof p.autoTotal !== 'number') {
        legacyCount++;
        return;
      }
      const at = p.autoTotal || 0;
      const ac = p.autoCorrect || 0;
      qTotal += at;
      qCorrect += ac;
      selfTotal += p.selfTotal || 0;
      selfCorrect += p.selfCorrect || 0;

      // 整节都是解答题时没有机器判分母，不参与单元排名（否则会显示 0% 假差生）
      if (!at) return;
      if (!unitMap.has(unit)) unitMap.set(unit, { unit, total: 0, correct: 0 });
      const u = unitMap.get(unit);
      u.total += at;
      u.correct += ac;
    });

    const hasAuto = qTotal > 0;
    const rate = pct(qCorrect, qTotal);
    const level = rate >= 90 ? '扎实' : rate >= 75 ? '基本过关' : rate >= 60 ? '需要补' : '要重讲';

    // 薄弱点：按错题次数排，取前 5
    const weakMap = new Map();
    wrongBook.forEach((w) => {
      if (!weakMap.has(w.nodeId)) {
        weakMap.set(w.nodeId, {
          nodeId: w.nodeId,
          nodeTitle: w.nodeTitle,
          unit: w.unit || '',
          times: 0,
          sample: ''
        });
      }
      const g = weakMap.get(w.nodeId);
      g.times += w.wrongCount || 1;
      if (!g.sample) g.sample = w.stem;
    });
    const weak = [...weakMap.values()].sort((a, b) => b.times - a.times).slice(0, 5);

    const units = [...unitMap.values()]
      .map((u) => Object.assign({}, u, { rate: pct(u.correct, u.total) }))
      .sort((a, b) => a.rate - b.rate);

    this.setData({
      empty: false,
      cloudOn,
      stat: {
        nodesDone: ids.length,
        qTotal, qCorrect, rate, level, hasAuto,
        selfTotal, selfCorrect, legacyCount
      },
      weak,
      units
    });

    if (cloudOn) {
      call('genReport', { scope: 'student' })
        .then((res) => this.setData({ cloud: (res && res.report) || null }))
        .catch(() => {});
    }
  },

  gotoWeak(e) {
    const id = e.currentTarget.dataset.nodeid;
    wx.navigateTo({ url: `/pages/learn/learn?id=${id}&mode=teach` });
  },

  goPractice(e) {
    const id = e.currentTarget.dataset.nodeid;
    wx.navigateTo({ url: `/pages/learn/learn?id=${id}&mode=practice` });
  }
});
