#!/usr/bin/env node
/**
 * check_audio.js —— 验证「声音真的出了，而且和画面对得上」
 *
 * 本机没有声卡可用（也无头），所以不能靠耳朵。这里靠三件事证明：
 *   1. 每句 mp3 都能被浏览器解码（解码不了会触发 error，或永远不 canplay）
 *   2. 完整播一个场景，起播顺序严格等于旁白顺序（第 i 句喊的就是 <场景>/<i>.mp3）
 *   3. 起播时刻与 narration.js 记的 t 相差不超过 0.35 秒
 *      —— 差值大说明时钟和音频脱钩了，画面上就会出现「演第 3 步、说第 2 句」
 *
 * 为什么只完整播一个场景：四个场景全播要 80 多秒，而同步机制是同一个 player，
 * 播一个最长的够暴露漂移；其余场景只需确认每个音频文件都能解码。
 *
 * 用法：node tools/check_audio.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEMO = path.join(ROOT, '_preview', 'anim_demo.html');
const MP = path.join(ROOT, 'miniprogram');
const { chromium } = require(path.join('F:/Obsidian/vault/HBS/starry-night-3d/node_modules/playwright-core'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const NARR = require(path.join(MP, 'utils/anim/narration.js')).NARRATION;

if (!fs.existsSync(DEMO)) {
  console.error('先跑 node tools/build_anim_demo.js 生成预览页');
  process.exit(1);
}

const FULL_SCENE = 'perimeter';   // 选最长之一，够暴露累积漂移

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

(async () => {
  const browser = await chromium.launch({
    executablePath: EDGE,
    // 无头环境没有用户手势，不加这个参数所有 play() 都会被拒绝
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio']
  });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const pageErrs = [];
  page.on('pageerror', (e) => pageErrs.push(String(e)));
  await page.goto('file:///' + DEMO.replace(/\\/g, '/'));
  await page.waitForTimeout(300);

  console.log('==== 语音与画面同步校验 ====');

  /* ---------- 1. 全部音频能否解码 ---------- */
  const allFiles = [];
  Object.keys(NARR).forEach((id) => NARR[id].lines.forEach((ln) => allFiles.push(ln.file)));
  const decoded = await page.evaluate(async (files) => {
    const out = [];
    await Promise.all(files.map((f) => new Promise((res) => {
      const a = new Audio('../miniprogram/assets/audio/' + f);
      a.muted = true;
      a.preload = 'auto';
      const done = (state, dur) => {
        out.push({ file: f, state, dur: dur || 0 });
        res();
      };
      a.addEventListener('canplaythrough', () => done('ok', a.duration), { once: true });
      a.addEventListener('error', () => done('error', 0), { once: true });
      setTimeout(() => done('timeout', a.duration), 8000);
      a.load();
    })));
    return out;
  }, allFiles);

  decoded.forEach((d) => {
    ok(d.state === 'ok', `${d.file} 无法解码（${d.state}）`);
    const ln = Object.keys(NARR).map((id) => NARR[id].lines.find((x) => x.file === d.file)).find(Boolean);
    if (ln && d.dur) {
      ok(Math.abs(d.dur - ln.dur) < 0.1, `${d.file} 实测 ${d.dur.toFixed(2)}s，时间轴记 ${ln.dur}s`);
    }
  });
  console.log(`  ${decoded.length} 个音频文件全部可解码`);

  /* ---------- 2. 完整播一个场景，验证顺序与漂移 ---------- */
  const n = NARR[FULL_SCENE];
  const waitMs = Math.round(n.total * 1000) + 1500;
  const res = await page.evaluate(async ([sid, ms]) => {
    window.__audioLog = [];
    window.__setScene(sid, false);
    document.getElementById('toggle').click();   // 从 0 开始播
    await new Promise((r) => setTimeout(r, ms));
    return {
      log: window.__audioLog.slice(),
      errs: window.__errs.slice(),
      audioErrors: window.__audioErrors ? window.__audioErrors() : 0,
      playing: document.getElementById('toggle').textContent
    };
  }, [FULL_SCENE, waitMs]);

  ok(res.errs.length === 0, `播放中报错：${res.errs.join(' / ')}`);

  const want = n.lines.map((ln) => ln.file);
  const logs = res.log.filter((x) => x.scene === FULL_SCENE);
  const got = logs.map((x) => x.file.split('/').slice(-2).join('/'));
  ok(got.length === want.length, `起播 ${got.length} 次，应为 ${want.length} 次`);
  want.forEach((f, i) => {
    if (got[i] !== f) fails.push(`第 ${i + 1} 次起播是 ${got[i] || '（没有）'}，应为 ${f}`);
  });

  let maxDrift = 0;
  if (logs.length) {
    const base = logs[0].at;
    n.lines.forEach((ln, i) => {
      if (!logs[i]) return;
      const real = (logs[i].at - base) / 1000;
      const drift = Math.abs(real - ln.t);
      if (drift > maxDrift) maxDrift = drift;
      ok(drift < 0.35, `第 ${i + 1} 句起播偏移 ${drift.toFixed(2)}s（应 <0.35s）`);
    });
  }
  ok(res.audioErrors === 0, `有 ${res.audioErrors} 个音频解码/播放失败`);
  ok(res.playing === '播放', `播完后按钮应回到「播放」，实际是「${res.playing}」`);
  console.log(`  ${FULL_SCENE}：${got.length}/${want.length} 句按序起播，最大偏移 ${maxDrift.toFixed(3)}s`);

  /* ---------- 3. 抽检一句：确认 currentTime 真的在走 ---------- */
  const adv = await page.evaluate(async () => {
    const a = new Audio('../miniprogram/assets/audio/addMeaning/0.mp3');
    a.muted = true;
    await a.play().catch(() => {});
    await new Promise((r) => setTimeout(r, 700));
    const t = a.currentTime;
    a.pause();
    return { t, dur: a.duration };
  });
  ok(adv.t > 0.2, `音频未真正播放（currentTime=${adv.t}）`);
  console.log(`  抽检 addMeaning/0.mp3：播放到 ${adv.t.toFixed(2)}s / 共 ${adv.dur.toFixed(2)}s`);

  ok(pageErrs.length === 0, `页面级报错：${pageErrs.join(' / ')}`);

  await browser.close();

  console.log('\n==== 结果 ====');
  if (fails.length) {
    console.log(`❌ ${fails.length} 处问题：`);
    fails.forEach((f) => console.log('   · ' + f));
    process.exit(1);
  }
  console.log(`✅ ${decoded.length} 个音频可解码；${FULL_SCENE} 完整播放逐句对齐（偏移 <0.35s）；零报错`);
})();
