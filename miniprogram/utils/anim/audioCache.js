// utils/anim/audioCache.js —— 概念卡语音的「云存储下载 + 本地缓存」
//
// 为什么概念卡语音不打包：微信单个分包上限 2048KB，428 张概念卡 ≈ 61MB，
// 切包要切 30 个，preload 会拖死启动。所以音频托管在云存储，进到某一节时
// 只下这一节的 5 个文件（约 146KB），存进 USER_DATA_PATH 后下次直接用。
//
// 三个设计要点：
//
// 1) **不阻塞开播**。下载是后台进行的，字幕立刻播；哪个文件下好就回填到
//    对应旁白行（learn 页的 narration.lines[i].file），下一句自然就带声了。
//    教室网差时最坏情况退化成纯字幕，和现在一样，不会卡住。
//
// 2) **按节点整组判定**。5 句里只要有 1 句下失败就整组当失败（返回 false），
//    半有声半无声比纯字幕更像「坏了」。
//
// 3) **连续失败即止损**。没配云环境 / 没网时，每一节都去试一次会白等 8 秒。
//    连续 3 次失败后本次会话不再尝试。
//
// 云端目录约定：<path>/<nodeId>/<句序号>.mp3，由 tools/gen_concept_audio.py 生成，
// 上传时保持这个目录结构即可（见 cloud_assets/ 与 UPLOAD.md）。

const REMOTE = {
  mode: 'cloud',            // 'cloud' = wx.cloud.downloadFile；'http' = wx.downloadFile
  fileIdPrefix: '',         // cloud 模式：cloud://<env>.<bucket>，上传后在 audioRemote 里填一次
  httpBase: '',             // http 模式：https://xxx/（末尾带斜杠）
  path: 'anim/concept'      // 云端目录前缀
};

const MAX_FAIL = 3;         // 连续失败这么多次就不再尝试
const CONCURRENCY = 2;      // 同时下几个（5 个文件，2 路足够，省得挤教室 wifi）
const TIMEOUT = 8000;       // 单个文件下载超时

const memo = {};            // nodeId -> [localPath, ...]（本次会话已就绪的）
const inflight = {};        // nodeId -> true（正在下，避免重复请求）
let failStreak = 0;

/** 运行时可覆盖配置（比如从 app.globalData 读云存储前缀） */
function configure(cfg) {
  if (!cfg) return;
  if (cfg.mode) REMOTE.mode = cfg.mode;
  if (cfg.fileIdPrefix != null) REMOTE.fileIdPrefix = cfg.fileIdPrefix;
  if (cfg.httpBase != null) REMOTE.httpBase = cfg.httpBase;
  if (cfg.path) REMOTE.path = cfg.path;
}

function fs() {
  try { return wx.getFileSystemManager(); } catch (e) { return null; }
}

function userRoot() {
  try { return wx.env.USER_DATA_PATH; } catch (e) { return ''; }
}

function dirOf(nodeId) {
  const root = userRoot();
  return root ? root + '/anim/' + nodeId : '';
}

function fileOf(nodeId, i) {
  const d = dirOf(nodeId);
  return d ? d + '/' + i + '.mp3' : '';
}

/** 远端地址：cloud 模式给 fileID，http 模式给完整 URL */
function remoteArg(nodeId, i) {
  const rel = REMOTE.path + '/' + nodeId + '/' + i + '.mp3';
  if (REMOTE.mode === 'http') {
    return REMOTE.httpBase ? REMOTE.httpBase + rel : '';
  }
  return REMOTE.fileIdPrefix ? REMOTE.fileIdPrefix + '/' + rel : '';
}

/** 云端是否可用（没配就彻底别试，省得每节白等） */
function remoteReady() {
  if (REMOTE.mode === 'http') return !!REMOTE.httpBase;
  if (!REMOTE.fileIdPrefix) return false;
  try {
    const app = getApp();
    return !!(app && app.globalData && app.globalData.cloudOn);
  } catch (e) {
    return false;
  }
}

function exists(p) {
  const m = fs();
  if (!m || !p) return false;
  try { m.accessSync(p); return true; } catch (e) { return false; }
}

function mkdirp(dir) {
  const m = fs();
  if (!m || !dir) return false;
  try { m.mkdirSync(dir, true); return true; } catch (e) {
    // 已存在也会抛，忽略
    return true;
  }
}

/** 把临时文件搬到缓存目录。saveFile 在老基础库不支持 filePath，退回 copyFile。 */
function saveAs(tmp, dest, cb) {
  const m = fs();
  if (!m) return cb(false);
  const done = (ok) => {
    if (ok) return cb(true);
    try {
      m.copyFile({ srcPath: tmp, destPath: dest, success: () => cb(true), fail: () => cb(false) });
    } catch (e) { cb(false); }
  };
  try {
    m.saveFile({ tempFilePath: tmp, filePath: dest, success: () => done(true), fail: () => done(false) });
  } catch (e) {
    done(false);
  }
}

function downloadOne(nodeId, i, cb) {
  const arg = remoteArg(nodeId, i);
  if (!arg) return cb(false, '');

  let settled = false;
  const finish = (ok, tmp) => {
    if (settled) return;
    settled = true;
    if (!ok || !tmp) return cb(false, '');
    const dest = fileOf(nodeId, i);
    saveAs(tmp, dest, (saved) => cb(saved, saved ? dest : ''));
  };

  const timer = setTimeout(() => finish(false, ''), TIMEOUT);
  const onOk = (tmp) => { clearTimeout(timer); finish(true, tmp); };
  const onFail = () => { clearTimeout(timer); finish(false, ''); };

  try {
    if (REMOTE.mode === 'http') {
      wx.downloadFile({ url: arg, success: (r) => (r.statusCode === 200 ? onOk(r.tempFilePath) : onFail()), fail: onFail });
    } else {
      wx.cloud.downloadFile({ fileID: arg, success: (r) => onOk(r.tempFilePath), fail: onFail });
    }
  } catch (e) {
    clearTimeout(timer);
    finish(false, '');
  }
}

/**
 * 确保某一节的语音都在本地。
 * @param {string} nodeId
 * @param {number} count   这一节有几句
 * @param {function} onFile (i, localPath) 每下好一句就回调（页面据此回填 narration.lines[i].file）
 * @param {function} onDone (ok) 整组结束；ok=false 表示这一节没声，走纯字幕
 */
function ensureFiles(nodeId, count, onFile, onDone) {
  const done = onDone || function () {};
  if (!nodeId || !count) return done(false);

  // 1) 本次会话已就绪
  if (memo[nodeId]) {
    for (let i = 0; i < memo[nodeId].length; i++) if (onFile) onFile(i, memo[nodeId][i]);
    return done(true);
  }
  // 2) 正在下，等它（避免同一节点重复请求）
  if (inflight[nodeId]) {
    inflight[nodeId].push({ onFile: onFile, onDone: done });
    return;
  }
  // 3) 连续失败止损 / 云端没配
  if (failStreak >= MAX_FAIL || !remoteReady() || !dirOf(nodeId)) return done(false);

  // 4) 先看本地缓存命中多少
  const paths = new Array(count);
  const missing = [];
  for (let i = 0; i < count; i++) {
    const p = fileOf(nodeId, i);
    if (exists(p)) { paths[i] = p; if (onFile) onFile(i, p); }
    else missing.push(i);
  }
  if (!missing.length) {
    memo[nodeId] = paths;
    return done(true);
  }

  if (!mkdirp(dirOf(nodeId))) return done(false);

  inflight[nodeId] = [{ onFile: onFile, onDone: done }];
  let left = missing.length;
  let failed = false;
  let cursor = 0;

  const settle = () => {
    const waiters = inflight[nodeId] || [];
    delete inflight[nodeId];
    if (failed) {
      failStreak++;
      for (let k = 0; k < waiters.length; k++) waiters[k].onDone(false);
    } else {
      failStreak = 0;
      memo[nodeId] = paths;
      for (let k = 0; k < waiters.length; k++) waiters[k].onDone(true);
    }
  };

  const next = () => {
    if (failed) return;
    if (cursor >= missing.length) {
      if (left === 0) settle();
      return;
    }
    const i = missing[cursor++];
    downloadOne(nodeId, i, (ok, p) => {
      left--;
      if (!ok) { failed = true; return settle(); }
      paths[i] = p;
      // 回填给所有等着这一节的页面（通常是 1 个）
      const waiters = inflight[nodeId] || [];
      for (let k = 0; k < waiters.length; k++) {
        if (waiters[k].onFile) waiters[k].onFile(i, p);
      }
      next();
    });
  };

  for (let c = 0; c < Math.min(CONCURRENCY, missing.length); c++) next();
}

/** 已经缓存了哪些节（给设置页/调试用） */
function cachedNodes() {
  return Object.keys(memo);
}

/** 清空本次会话的记录（本地文件留着，下次直接命中） */
function reset() {
  for (const k in memo) delete memo[k];
  failStreak = 0;
}

module.exports = { configure, ensureFiles, remoteReady, cachedNodes, reset, REMOTE };
