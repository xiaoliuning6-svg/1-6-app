// pages/teacher/teacher.js —— 教师端：内容覆盖一览 + 本机练习概况 + 班级汇总（需云环境）
const { books, nodes } = require('../../data/content.js');
const { call, isCloudOn } = require('../../utils/cloud.js');

Page({
  data: {
    cloudOn: false,
    books: [],       // 每册覆盖：知识点数/题数/单元数
    local: null,     // 本机练习概况
    classStats: [],  // 云端：按知识点聚合的错误
    classReport: null
  },

  onShow() {
    this.buildLocal();
  },

  buildLocal() {
    const cloudOn = isCloudOn();
    const progress = wx.getStorageSync('progress') || {};
    const ids = Object.keys(progress);

    const bookList = books.map((b) => ({
      key: b.key,
      title: b.title,
      nodeCount: b.nodeCount,
      questionCount: b.questionCount,
      unitCount: (b.units || []).length
    }));

    // 与报告页同一口径：正确率只认机器判分题，旧记录（混了自评）排除。
    let qTotal = 0;
    let qCorrect = 0;
    let selfTotal = 0;
    let selfCorrect = 0;
    let legacyCount = 0;
    ids.forEach((id) => {
      const p = progress[id] || {};
      if (p.v !== 2 || typeof p.autoTotal !== 'number') {
        legacyCount++;
        return;
      }
      qTotal += p.autoTotal || 0;
      qCorrect += p.autoCorrect || 0;
      selfTotal += p.selfTotal || 0;
      selfCorrect += p.selfCorrect || 0;
    });

    this.setData({
      cloudOn,
      books: bookList,
      local: {
        nodesDone: ids.length,
        nodeAll: nodes.length,
        qTotal,
        qCorrect,
        selfTotal,
        selfCorrect,
        legacyCount,
        hasAuto: qTotal > 0,
        rate: qTotal ? Math.round((qCorrect / qTotal) * 100) : 0
      }
    });

    if (cloudOn) this.loadClassStats();
  },

  loadClassStats() {
    call('getClassStats', {})
      .then((res) => this.setData({ classStats: (res && res.stats) || [] }))
      .catch(() => this.setData({ classStats: [] }));
  },

  genClassReport() {
    if (!isCloudOn()) {
      wx.showToast({ title: '需先配置云环境', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '汇总中…' });
    call('genReport', { scope: 'class' })
      .then((res) => {
        wx.hideLoading();
        this.setData({ classReport: (res && res.report) || null });
      })
      .catch((e) => {
        wx.hideLoading();
        wx.showToast({ title: '汇总失败，检查云函数', icon: 'none' });
        console.warn('[teacher] genReport 失败', e);
      });
  },

  // 本机统计复制到剪贴板，方便贴到群里/表格
  copyStats() {
    const { local, books } = this.data;
    if (!local) return;
    const lines = [
      local.hasAuto
        ? `【本机练习概况】练过 ${local.nodesDone} 个知识点；自动判分 ${local.qCorrect}/${local.qTotal} 题，正确率 ${local.rate}%`
        : '【本机练习概况】暂无机器判分成绩（当前记录只有解答题自评）',
      `解答题自评 ${local.selfCorrect}/${local.selfTotal} 题（学生自评，不计入正确率）`,
      local.legacyCount ? `另有 ${local.legacyCount} 节旧口径记录未计入，重做一次即可更新` : '',
      '',
      '【内容覆盖】'
    ].filter((x) => x !== '').concat(books.map((b) => `${b.title}：${b.nodeCount} 个知识点 / ${b.questionCount} 道练习 / ${b.unitCount} 个单元`));
    wx.setClipboardData({ data: lines.join('\n') });
  }
});
