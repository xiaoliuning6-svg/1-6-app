#!/usr/bin/env node
/**
 * tools/upload_concept_audio.js
 * --------------------------------------------------------------------------
 * 把本地 cloud_assets/anim/concept/<nodeId>/<i>.mp3（428 卡 / 2140 文件）上传到
 * 微信云存储，并保持同样的目录结构： anim/concept/<nodeId>/<i>.mp3
 *
 * 前置（需你本人做，我跨不过去）：
 *   1) 微信开发者工具已开通云开发环境，拿到 env ID（形如 math-pilot-xxxx）
 *   2) 已安装 tcb 并登录：  npm i -g @cloudbase/cli && tcb login  （浏览器扫码）
 *
 * 用法：
 *   node tools/upload_concept_audio.js --dry            # 只扫本地，输出统计 + 生成 manifest.json
 *   node tools/upload_concept_audio.js -e <envId>       # 真正上传（逐文件，幂等可重跑）
 *   node tools/upload_concept_audio.js -e <envId> --dir # 尝试整目录一次性上传（更快，依赖 tcb 递归支持）
 *
 * 上传完成后务必去控制台把 anim/concept 目录权限设为「所有用户可读」，
 * 否则学生端 wx.cloud.downloadFile 会 403，全部退化成纯字幕。脚本末尾会打印直达链接。
 * --------------------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', 'cloud_assets', 'anim', 'concept');
const REMOTE_BASE = 'anim/concept';

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function relTo(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function tcb(args, env) {
  const full = ['--env', env, ...args];
  const r = spawnSync('tcb', full, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || ''), raw: r };
}

/** 扫描本地，输出统计并写 manifest */
function dryRun() {
  if (!fs.existsSync(ROOT)) {
    console.error('❌ 本地目录不存在:', ROOT);
    process.exit(1);
  }
  const files = walk(ROOT);
  let total = 0;
  const cards = new Set();
  for (const f of files) {
    total += fs.statSync(f).size;
    cards.add(relTo(f).split('/')[0]);
  }
  const manifest = {
    generatedAt: new Date().toISOString(),
    root: ROOT,
    remoteBase: REMOTE_BASE,
    cardCount: cards.size,
    fileCount: files.length,
    totalBytes: total,
    totalMB: +(total / 1048576).toFixed(2),
    files: files.map((f) => ({ rel: relTo(f), bytes: fs.statSync(f).size })),
  };
  const mf = path.resolve(__dirname, '_upload_manifest.json');
  fs.writeFileSync(mf, JSON.stringify(manifest, null, 2));
  console.log('✅ 本地扫描完成');
  console.log('   概念卡目录数 :', cards.size);
  console.log('   mp3 文件数   :', files.length);
  console.log('   总大小       :', manifest.totalMB, 'MB');
  console.log('   manifest 已写:', mf);
  // 抽样展示目录结构
  console.log('   目录结构样例 :');
  console.log('     anim/concept/<nodeId>/0.mp3 ... 4.mp3');
  console.log('   首个节点示例 :', files.find((f) => true) ? relTo(files[0]) : '(无)');
}

/** 真正上传 */
function upload(env, useDir) {
  if (!fs.existsSync(ROOT)) {
    console.error('❌ 本地目录不存在:', ROOT);
    process.exit(1);
  }
  // 1) tcb 可用性
  const probe = tcb(['storage', 'list', REMOTE_BASE], env);
  if (probe.code !== 0) {
    console.error('❌ tcb 调用失败（先确认已 `tcb login` 且 env 正确）:');
    console.error(probe.out.split('\n').slice(0, 8).join('\n'));
    console.error('\n👉 操作顺序：npm i -g @cloudbase/cli → tcb login（扫码）→ 重跑本脚本');
    process.exit(1);
  }

  if (useDir) {
    console.log('📤 尝试整目录上传（依赖 tcb 递归）...');
    const r = tcb(['storage', 'upload', ROOT, REMOTE_BASE], env);
    console.log(r.out.split('\n').slice(-12).join('\n'));
    if (r.code !== 0) {
      console.error('⚠️ 目录模式失败，请用逐文件模式：node tools/upload_concept_audio.js -e ' + env);
      process.exit(r.code || 1);
    }
  } else {
    const files = walk(ROOT);
    const total = files.length;
    let ok = 0, fail = 0;
    files.forEach((f, idx) => {
      const rel = relTo(f);
      const remote = REMOTE_BASE + '/' + rel;
      const r = tcb(['storage', 'upload', f, remote], env);
      if (r.code === 0) {
        ok++;
        if (idx % 100 === 0 || idx === total - 1)
          console.log(`  [${idx + 1}/${total}] ✅ ${rel}`);
      } else {
        fail++;
        console.error(`  [${idx + 1}/${total}] ❌ ${rel}\n${r.out.split('\n').slice(0, 3).join('\n')}`);
      }
    });
    console.log(`\n上传结束：成功 ${ok} / 失败 ${fail} / 共 ${total}`);
    if (fail) process.exit(1);
  }

  // 2) 权限指引（tcb 无 setACL 命令，必须控制台点）
  console.log('\n' + '='.repeat(60));
  console.log('⚠️  必须做这一步，否则学生端听不到声音（403 退化纯字幕）：');
  console.log('   打开云开发控制台 → 存储 → 选中 anim/concept 目录');
  console.log('   → 权限设置 → 选「所有用户可读，仅创建者可读写」');
  console.log('   直达链接：');
  console.log('   https://console.cloud.tencent.com/tcb/storage?envId=' + env);
  console.log('='.repeat(60));
  console.log('\n3) 填配置（只需一次）：');
  console.log('   miniprogram/app.js                → env 改成 "' + env + '"');
  console.log('   miniprogram/utils/anim/audioCache.js → fileIdPrefix 改成 "cloud://<env>.<bucket>"');
  console.log('   （bucket 在控制台存储页的文件 ID 里能看到，形如 cloud://' + env + '.xxxxx）');
}

function main() {
  const args = process.argv.slice(2);
  const isDry = args.includes('--dry');
  const useDir = args.includes('--dir');
  const envIdx = args.indexOf('-e');
  const env = envIdx >= 0 ? args[envIdx + 1] : '';

  if (isDry) return dryRun();
  if (!env) {
    console.error('用法：');
    console.error('  node tools/upload_concept_audio.js --dry                # 本地扫描');
    console.error('  node tools/upload_concept_audio.js -e <envId>           # 上传');
    console.error('  node tools/upload_concept_audio.js -e <envId> --dir    # 目录模式');
    process.exit(1);
  }
  upload(env, useDir);
}

main();
