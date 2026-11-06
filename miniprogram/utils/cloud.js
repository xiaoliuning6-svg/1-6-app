// utils/cloud.js —— 云函数调用封装：统一 loading 与错误处理
// 本机模式（未配云环境）直接 reject，调用方各自 catch 降级，不弹错、不卡界面。

function isCloudOn() {
  try {
    const app = getApp();
    return !!(app && app.globalData && app.globalData.cloudOn);
  } catch (e) {
    return false;
  }
}

function call(name, data = {}) {
  return new Promise((resolve, reject) => {
    if (!isCloudOn()) {
      reject(new Error('LOCAL_MODE'));
      return;
    }
    wx.cloud
      .callFunction({ name, data })
      .then((res) => {
        const r = res && res.result;
        if (!r) return reject(new Error('云函数返回空'));
        if (r.ok === false) return reject(new Error(r.msg || '云函数返回失败'));
        resolve(r);
      })
      .catch((err) => {
        console.error(`[cloud] ${name} 调用失败`, err);
        reject(err);
      });
  });
}

module.exports = { call, isCloudOn };
