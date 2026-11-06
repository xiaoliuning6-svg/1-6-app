// utils/auth.js —— 微信登录 + openid 缓存；兜底学号绑定
const { call } = require('./cloud.js');

// 获取 openid（优先缓存）
function ensureOpenid() {
  const app = getApp();
  if (app.globalData.openid) return Promise.resolve(app.globalData.openid);
  return call('getOpenid').then(res => {
    app.globalData.openid = res.openid;
    return res.openid;
  }).catch(err => {
    console.error('获取 openid 失败，使用学号兜底', err);
    return null;
  });
}

// 学号 + 姓名 兜底绑定（登录失败时调用）
function bindByStudentNo(studentNo, nameMask) {
  const app = getApp();
  app.globalData.studentNo = studentNo;
  app.globalData.nameMask = nameMask;
  return Promise.resolve({ studentNo, nameMask });
}

module.exports = { ensureOpenid, bindByStudentNo };
