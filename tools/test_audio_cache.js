// tools/test_audio_cache.js —— audioCache 的行为测试（Node 模拟 wx 运行时）
//
// 本机没有开发者工具，缓存层最容易出的错不是「下载失败」（那种会降级成字幕，
// 看得见），而是这几种静默错误：
//   1. 缓存命中了却重新下载（费流量、慢）
//   2. 目录没建就写文件（真机报 fail，测试里必须暴露）
//   3. 失败后还在反复重试（每节白等 8 秒）
//   4. onFile 回填的下标错位（第 3 句的音频给了第 1 句）
//
// 运行：node tools/test_audio_cache.js

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wxaudio-'));
const userPath = path.join(tmpRoot, 'usr');
fs.mkdirSync(userPath, { recursive: true });

let failures = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  ✓ ' : '  ❌ ') + msg);
  if (!cond) failures++;
};

/* ---------- 模拟小程序运行时 ---------- */
let downloadCalls = [];
let failMode = false;
let tmpSeq = 0;

const fsm = {
  accessSync(p) { fs.accessSync(p); },
  mkdirSync(d, rec) { fs.mkdirSync(d, { recursive: !!rec }); },
  saveFile(o) {
    try {
      fs.mkdirSync(path.dirname(o.filePath), { recursive: true });
      fs.copyFileSync(o.tempFilePath, o.filePath);
      o.success && o.success({ savedFilePath: o.filePath });
    } catch (e) { o.fail && o.fail(e); }
  },
  copyFile(o) {
    try {
      fs.mkdirSync(path.dirname(o.destPath), { recursive: true });
      fs.copyFileSync(o.srcPath, o.destPath);
      o.success && o.success({});
    } catch (e) { o.fail && o.fail(e); }
  }
};

global.wx = {
  env: { USER_DATA_PATH: userPath },
  getFileSystemManager: () => fsm,
  cloud: {
    downloadFile(o) {
      downloadCalls.push(o.fileID);
      setTimeout(() => {
        if (failMode) return o.fail && o.fail(new Error('mock net error'));
        tmpSeq++;
        const tmp = path.join(tmpRoot, 'tmp' + tmpSeq + '.mp3');
        fs.writeFileSync(tmp, Buffer.alloc(3000, 7));
        o.success && o.success({ tempFilePath: tmp });
      }, 5);
    }
  }
};
global.getApp = () => ({ globalData: { cloudOn: true } });

const cache = require(path.join(ROOT, 'miniprogram/utils/anim/audioCache.js'));

const run = (nodeId, n) => new Promise((resolve) => {
  const got = [];
  cache.ensureFiles(nodeId, n,
    (i, p) => got.push({ i: i, p: p }),
    (okAll) => resolve({ okAll: okAll, got: got }));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  console.log('==== audioCache 行为测试 ====');

  // 1. 云端没配 → 直接 false，不该发请求
  console.log('\n[1] 云端未配置');
  downloadCalls = [];
  let r = await run('n1', 5);
  ok(r.okAll === false, '未配置 fileIdPrefix 时返回 false（走纯字幕）');
  ok(downloadCalls.length === 0, '未配置时一次请求都不发');

  // 2. 配好前缀 → 下载 5 个、回填 5 个、下标不错位
  console.log('\n[2] 首次下载');
  cache.configure({ mode: 'cloud', fileIdPrefix: 'cloud://env.bucket', path: 'anim/concept' });
  cache.reset();
  downloadCalls = [];
  r = await run('n2', 5);
  ok(r.okAll === true, '整组下载成功返回 true');
  ok(downloadCalls.length === 5, `发了 5 次请求（实际 ${downloadCalls.length}）`);
  ok(r.got.length === 5, `onFile 回调 5 次（实际 ${r.got.length}）`);
  const idxOk = r.got.every((g) => g.p.indexOf('/n2/' + g.i + '.mp3') >= 0);
  ok(idxOk, '每个回调的路径下标与句序号一致（不错位）');
  ok(downloadCalls[0] === 'cloud://env.bucket/anim/concept/n2/0.mp3', 'fileID 拼接正确');
  const f0 = path.join(userPath, 'anim', 'n2', '0.mp3');
  ok(fs.existsSync(f0), '文件已落到 USER_DATA_PATH/anim/<nodeId>/0.mp3');

  // 3. 同一会话再进 → 命中 memory，不再请求
  console.log('\n[3] 会话内命中');
  downloadCalls = [];
  r = await run('n2', 5);
  ok(r.okAll === true && downloadCalls.length === 0, '直接命中 memo，零请求');

  // 4. 清掉 memo（模拟重启）→ 命中本地磁盘，仍不再请求
  console.log('\n[4] 冷启动命中本地磁盘');
  cache.reset();
  downloadCalls = [];
  r = await run('n2', 5);
  ok(r.okAll === true && downloadCalls.length === 0, '本地文件在，零请求');
  ok(r.got.length === 5, '仍然回填 5 个路径（页面需要它挂到旁白行上）');

  // 5. 删掉中间两个 → 只补缺的两个
  console.log('\n[5] 部分缺失');
  cache.reset();
  fs.unlinkSync(path.join(userPath, 'anim', 'n2', '1.mp3'));
  fs.unlinkSync(path.join(userPath, 'anim', 'n2', '3.mp3'));
  downloadCalls = [];
  r = await run('n2', 5);
  ok(r.okAll === true, '补齐后整组成功');
  ok(downloadCalls.length === 2, `只下缺的 2 个（实际 ${downloadCalls.length}）`);
  // 注意：命中的 3 个也必须回调 —— 页面要把它挂到 narration.lines[i].file 上，
  // 只在下载时回填的话，缓存文件永远播不出来（第二次进来反而没声）。
  const gotIdx = r.got.map((g) => g.i).sort().join(',');
  ok(gotIdx === '0,1,2,3,4', `五个下标都回填（实际 ${gotIdx}）`);

  // 6. 下载失败 → false，且不写半截文件
  console.log('\n[6] 下载失败');
  cache.reset();
  failMode = true;
  downloadCalls = [];
  r = await run('n3', 5);
  ok(r.okAll === false, '失败时返回 false（页面据此走字幕）');
  const n3dir = path.join(userPath, 'anim', 'n3');
  const leftovers = fs.existsSync(n3dir) ? fs.readdirSync(n3dir).filter((f) => f.endsWith('.mp3')) : [];
  ok(leftovers.length === 0, `失败不落任何半截文件（实际 ${leftovers.length} 个）`);

  // 7. 连续失败止损：3 次之后不再发请求
  console.log('\n[7] 连续失败止损');
  await run('n4', 5);
  await run('n5', 5);
  const callsBefore = downloadCalls.length;
  await sleep(30);
  r = await run('n6', 5);
  ok(r.okAll === false, '止损后返回 false');
  ok(downloadCalls.length === callsBefore, '止损后不再发请求（不白等超时）');

  // 8. 恢复网络 + reset → 重新可用
  console.log('\n[8] 恢复后用 reset 复位');
  failMode = false;
  cache.reset();
  r = await run('n7', 5);
  ok(r.okAll === true, 'reset 后恢复正常下载');

  // 9. count 为 0 或非法 nodeId → 不崩
  console.log('\n[9] 边界');
  r = await run('', 5);
  ok(r.okAll === false, '空 nodeId 安全返回 false');
  r = await run('n8', 0);
  ok(r.okAll === false, 'count=0 安全返回 false');

  console.log(failures === 0 ? `\n✅ 全部通过` : `\n❌ ${failures} 项失败`);
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) { /* 临时目录清不掉无所谓 */ }
  process.exit(failures === 0 ? 0 : 1);
})();
