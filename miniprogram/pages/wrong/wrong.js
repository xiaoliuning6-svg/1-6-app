// pages/wrong/wrong.js —— 错题本：按知识点分组，可展开看答案解析，可跳回原知识点重听
Page({
  data: {
    groups: [],     // [{ nodeId, nodeTitle, unit, items: [...] }]
    count: 0,
    openId: ''      // 当前展开的题目 id
  },

  onShow() {
    this.render();
  },

  render() {
    const book = wx.getStorageSync('wrongBook') || [];
    // 按知识点聚合，最近错的排前面
    const map = new Map();
    book.forEach((w) => {
      if (!map.has(w.nodeId)) {
        map.set(w.nodeId, {
          nodeId: w.nodeId,
          nodeTitle: w.nodeTitle,
          unit: w.unit || '',
          items: []
        });
      }
      map.get(w.nodeId).items.push(w);
    });
    const groups = [...map.values()].map((g) => {
      g.items.sort((a, b) => (b.wrongCount || 1) - (a.wrongCount || 1));
      g.recent = Math.max.apply(null, g.items.map((i) => i.lastAt || 0));
      return g;
    });
    groups.sort((a, b) => b.recent - a.recent);
    this.setData({ groups, count: book.length });
  },

  toggle(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ openId: this.data.openId === id ? '' : id });
  },

  // 跳回该知识点，用讲解模式重听一遍
  gotoNode(e) {
    const id = e.currentTarget.dataset.nodeid;
    wx.navigateTo({ url: `/pages/learn/learn?id=${id}&mode=teach` });
  },

  // 单题移除（已经会了）
  remove(e) {
    const id = e.currentTarget.dataset.id;
    const book = (wx.getStorageSync('wrongBook') || []).filter((x) => x.questionId !== id);
    wx.setStorageSync('wrongBook', book);
    this.render();
    wx.showToast({ title: '已移出错题本', icon: 'none' });
  },

  clear() {
    wx.showModal({
      title: '清空错题本',
      content: '只清本机记录，云端记录不受影响。确定清空？',
      confirmText: '清空',
      confirmColor: '#e54d42',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('wrongBook');
          this.render();
        }
      }
    });
  }
});
