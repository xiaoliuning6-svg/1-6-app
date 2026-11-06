// tools/check_concept_cloud.js —— 概念卡语音「上传到云之后」的可达性抽检
//
// 为什么需要它：gen_concept_audio.py 把 2140 个 mp3 落到本地 cloud_assets/，
// 上传到云存储后，文件是否真的能按 <prefix>/<nodeId>/<i>.mp3 取到，要在客户端
// 进某一节才会发现（下载失败→静默降级字幕，听不出错）。本脚本在上传后立刻抽检，
// 把「云端路径拼错 / 漏传目录 / 前缀填反」这类问题挡在上线前。
//
// 两种模式：
//   http 模式（方式三：COS/CDN 等静态托管）：脚本直接发请求，真实探测可达性。
//   cloud 模式（微信云存储）：Node 调不了 wx.cloud，脚本只做配置体检 +
//            打印一段可直接粘进「微信开发者工具 Console」的验证代码。
//
// 运行：
//   node tools/check_concept_cloud.js                 # 用 audioCache.js 里的 REMOTE
//   node tools/check_concept_cloud.js --sample 8      # 抽 8 个
//   node tools/check_concept_cloud.js --base https://cdn.xxx/anim/concept/
//                                              # 临时覆盖 httpBase（不改代码）

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const { REMOTE } = require(path.join(ROOT, 'miniprogram/utils/anim/audioCache.js'));
const { CONCEPT_AUDIO } = require(path.join(ROOT, 'miniprogram/utils/anim/narration_concept.js'));

const args = process.argv.slice(2);
const getArg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const SAMPLE = parseInt(getArg('--sample') || '5', 10) || 5;
let mode = REMOTE.mode;
let base = REMOTE.httpBase;
let prefix = REMOTE.fileIdPrefix;
if (getArg('--base')) { mode = 'http'; base = getArg('--base').replace(/\/+$/, '/'); }

const nodeIds = Object.keys(CONCEPT_AUDIO);
console.log('==== 概念卡云端语音 · 上传后抽检 ====');
console.log(`索引节点 ${nodeIds.length} 个；模式 ${mode}`);

if (mode !== 'http' || !base) {
  console.log('\n⚠️ 当前不是 http 模式（或未填 httpBase）。');
  console.log('   cloud 模式下 Node 无法调用 wx.cloud，请在「微信开发者工具」里抽一个节点验证：\n');
  console.log('   // 微信开发者工具 Console 粘贴执行（确认某节点 5 句都能取到）');
  console.log('   wx.cloud.downloadFile({');
  console.log('     fileID: "cloud://<你的环境ID>.<存储桶>/anim/concept/bsd-g1s-003/0.mp3"');
  console.log('   }).then(r => console.log("OK", r.tempFilePath)).catch(e => console.log("FAIL", e));');
  console.log('\n   想让本脚本做真实探测，改 audioCache.js 为 http 模式并填 httpBase，或加 --base 参数。');
  console.log('   （见 cloud_assets/上传说明.md 方式三）');
  process.exit(0);
}

function urlOf(nodeId, i) {
  const rel = REMOTE.path ? REMOTE.path.replace(/\/+$/, '') + '/' : '';
  return base + rel + nodeId + '/' + i + '.mp3';
}

function checkOne(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'GET', headers: { Range: 'bytes=0-0' } }, (res) => {
      res.resume();
      const ok = res.statusCode === 200 || res.statusCode === 206;
      resolve({ ok, code: res.statusCode, len: res.headers['content-range'] || res.headers['content-length'] || '' });
    });
    req.on('error', (e) => resolve({ ok: false, code: 'ERR', len: e.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false, code: 'TIMEOUT', len: '' }); });
    req.end();
  });
}

(async () => {
  // 随机抽 SAMPLE 个节点，每个节点抽第 0 句（覆盖不同目录即可，不必 5 句全查）
  const pool = nodeIds.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const picks = pool.slice(0, Math.min(SAMPLE, pool.length));
  console.log(`\n随机抽 ${picks.length} 个节点，每个查第 0 句（url 形如 ${urlOf('bsd-g1s-003', 0)}）\n`);
  let fail = 0;
  for (const id of picks) {
    const url = urlOf(id, 0);
    const r = await checkOne(url);
    const tag = r.ok ? '✅' : '❌';
    if (!r.ok) fail++;
    console.log(`  ${tag} ${id}/0.mp3  →  ${r.code}${r.len ? ' (' + r.len + ')' : ''}`);
  }
  console.log('\n' + (fail === 0 ? `✅ 抽检全部可达（共 ${nodeIds.length} 节点 / 2140 文件，上传完整）` : `❌ 有 ${fail} 个节点取不到，检查上传路径/前缀/base 是否与 audioCache.js 一致`));
  process.exit(fail === 0 ? 0 : 1);
})();
