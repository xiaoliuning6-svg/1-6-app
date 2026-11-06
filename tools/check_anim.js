#!/usr/bin/env node
/**
 * check_anim.js —— 用无头 Edge 逐个场景逐帧校验动画
 *
 * 为什么需要：本机没有开发者工具，光看代码发现不了「第 5 秒少了一个圆点」
 * 或者「文字压到图形上」这类问题。这里把预览页在无头浏览器里打开，
 * 定格截图 + 统计非白像素比例，断言：
 *   1. 全程零 JS 报错（一帧崩了后面全是空白）
 *   2. 每一帧真的有内容画出来（不是空白画布）
 *   3. 关键帧的像素量在合理区间（防止「只剩一行字」这种塌陷）
 *   4. 每句旁白播放时，字幕栏显示的就是那句的原话
 *
 * 采样点不再写死秒数，而是**按旁白逐句取中点** ——
 * 因为时间轴是由音频实测时长算出来的，写死秒数会在改过文案后全部失准。
 * 这样每次采样的语义固定：「说到第 i 句时，画面应该已经画出对应的东西」。
 *
 * 用法：node tools/check_anim.js
 * 产物：_preview/anim/<场景>_L<句号>.png
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEMO = path.join(ROOT, '_preview', 'anim_demo.html');
const SHOTS = path.join(ROOT, '_preview', 'anim');
const { chromium } = require(path.join('F:/Obsidian/vault/HBS/starry-night-3d/node_modules/playwright-core'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

if (!fs.existsSync(DEMO)) {
  console.error('先跑 node tools/build_anim_demo.js 生成预览页');
  process.exit(1);
}

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: EDGE,
    // 无头环境没有用户手势，不加这个参数音频会被浏览器直接拒绝
    args: ['--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  await page.goto('file:///' + DEMO.replace(/\\/g, '/'));
  await page.waitForTimeout(400);

  const scenes = await page.evaluate(() => window.__sceneIds || []);
  const narr = await page.evaluate(() => window.__narration || {});
  console.log(`==== 动画逐帧校验（${scenes.length} 个场景）====`);

  for (const id of scenes) {
    const n = narr[id];
    if (!n) { fails.push(`${id} 没有旁白时间轴`); continue; }
    const row = [];
    for (let i = 0; i < n.lines.length; i++) {
      const info = await page.evaluate(([sid, idx]) => {
        window.__poseAtLine(sid, idx);
        const cv = document.getElementById('cv');
        const ctx = cv.getContext('2d');
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let ink = 0;
        for (let k = 0; k < d.length; k += 4) {
          // 和白底差得明显才算「有内容」
          if (d[k] < 245 || d[k + 1] < 245 || d[k + 2] < 245) ink++;
        }
        return {
          ratio: ink / (cv.width * cv.height),
          subtitle: document.getElementById('subtitle').textContent.trim(),
          errs: window.__errs.slice()
        };
      }, [id, i]);

      const tag = `${id} 第${i + 1}句`;
      ok(info.errs.length === 0, `${tag} 报错：${info.errs.join(' / ')}`);
      ok(info.ratio > 0.004, `${tag} 画面几乎空白（墨迹占比 ${(info.ratio * 100).toFixed(2)}%）`);
      ok(info.ratio < 0.75, `${tag} 墨迹占比异常高（${(info.ratio * 100).toFixed(1)}%），可能整屏涂死了`);
      ok(info.subtitle === n.lines[i].text,
        `${tag} 字幕与旁白不一致：显示「${info.subtitle}」，应为「${n.lines[i].text}」`);

      row.push(`L${i + 1}:${(info.ratio * 100).toFixed(1)}%`);
      const el = await page.$('#cv');
      await el.screenshot({ path: path.join(SHOTS, `${id}_L${i + 1}.png`) });
    }
    // 结尾一帧：所有结论都应该已经落在画面上
    const tail = await page.evaluate(([sid]) => {
      const total = window.__pose(sid, 1e6);
      const cv = document.getElementById('cv');
      const ctx = cv.getContext('2d');
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let ink = 0;
      for (let k = 0; k < d.length; k += 4) {
        if (d[k] < 245 || d[k + 1] < 245 || d[k + 2] < 245) ink++;
      }
      return { total, ratio: ink / (cv.width * cv.height), errs: window.__errs.slice() };
    }, [id]);
    ok(tail.errs.length === 0, `${id} 结尾帧报错：${tail.errs.join(' / ')}`);
    ok(tail.ratio > 0.004, `${id} 结尾帧几乎空白（${(tail.ratio * 100).toFixed(2)}%）`);
    row.push(`尾:${(tail.ratio * 100).toFixed(1)}%`);
    const elTail = await page.$('#cv');
    await elTail.screenshot({ path: path.join(SHOTS, `${id}_end.png`) });

    console.log(`  ${id.padEnd(12)} ${n.total.toFixed(1)}s  ${row.join('  ')}`);
  }

  const errs = await page.evaluate(() => window.__errs);
  ok(errs.length === 0, `预览页整体报错：${errs.join(' / ')}`);

  await browser.close();

  console.log('\n==== 结果 ====');
  if (fails.length) {
    console.log(`❌ ${fails.length} 处问题：`);
    fails.forEach((f) => console.log('   · ' + f));
    process.exit(1);
  }
  console.log(`✅ ${scenes.length} 个场景逐句定格 + 结尾帧全部正常，字幕与旁白逐句一致，零报错`);
})();
