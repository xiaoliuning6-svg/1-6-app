// app.js —— 全局初始化云开发环境
// 关键设计：内容（知识点/题目）走包内 data/content.js，与云环境无关；
// 云环境只负责“跨设备汇总”（练习记录、错题、报告）。没配 env 也能完整用起来。
App({
  globalData: {
    // 换成你自己的云开发环境 ID（微信开发者工具 → 云开发控制台 → 环境设置）
    // 保持占位符即“本机模式”：内容可看可练，记录只存本机。
    env: 'your-cloud-env-id',
    cloudOn: false,
    openid: null,
    role: 'student',
    studentNo: null,
    nameMask: null
  },

  onLaunch() {
    const env = this.globalData.env;
    const configured = env && env !== 'your-cloud-env-id';

    if (!configured) {
      this.globalData.cloudOn = false;
      console.warn('[app] 本机模式：未填云环境 ID。内容与作答全部可用，班级汇总不可用。');
      return;
    }
    if (!wx.cloud) {
      this.globalData.cloudOn = false;
      console.error('[app] 基础库不支持云开发（需 2.2.3+），已降级本机模式');
      return;
    }
    try {
      wx.cloud.init({ env, traceUser: true });
      this.globalData.cloudOn = true;
    } catch (e) {
      this.globalData.cloudOn = false;
      console.error('[app] 云开发初始化失败，已降级本机模式', e);
    }
  }
});
