#!/usr/bin/env node
/**
 * lint_miniprogram.js —— 小程序静态检查（不需要微信开发者工具，也不需要模拟器）
 *
 * 抓这几类最容易在真机/模拟器上才暴露、但静态就能发现的问题：
 *   1  .js 语法错误（node --check）
 *   2  .json 不是合法 JSON（app.json / 页面 json / project.config.json）
 *   3  app.json 的 pages 路径四件套（js/json/wxml/wxss）是否齐全
 *   4  WXML 里 bind / catch 绑定的处理函数在对应 .js 里是否存在（错拼函数名是高频 bug）
 *   5  WXML 标签是否配对（未闭合 view 会让整页渲染错乱且不报错）
 *   6  WXML 里 wx:for 嵌套是否用 wx:for-item 区分（默认都是 item，嵌套必踩）
 *   7  WXSS 花括号配对
 *   8  require 的本地模块文件是否存在
 *
 * 用法：node tools/lint_miniprogram.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');
const fails = [];
const fail = (m) => fails.push(m);

/* ---------- 1. 收集文件 ---------- */
function walk(dir, out = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p, out);
    else out.push(p);
  });
  return out;
}
const files = walk(MP);

/* ---------- 2. JS 语法 ---------- */
const jsFiles = files.filter((f) => f.endsWith('.js'));
jsFiles.forEach((f) => {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    fail(`JS 语法错误：${path.relative(ROOT, f)}\n     ${String(e.stderr || e.message).split('\n').slice(0, 3).join('\n     ')}`);
  }
});

/* ---------- 3. JSON 合法 ---------- */
const jsonFiles = files.filter((f) => f.endsWith('.json'));
jsonFiles.forEach((f) => {
  try {
    JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    fail(`JSON 格式错误：${path.relative(ROOT, f)}（${e.message}）`);
  }
});

/* ---------- 4. app.json 页面四件套 ---------- */
let appJson = null;
try {
  appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
} catch (e) {
  fail('app.json 读不到或格式错误');
}
if (appJson) {
  const exts = ['.js', '.json', '.wxml', '.wxss'];
  (appJson.pages || []).forEach((p) => {
    exts.forEach((ext) => {
      const f = path.join(MP, p + ext);
      if (!fs.existsSync(f)) fail(`app.json 声明了 ${p}，但缺 ${path.basename(p)}${ext}`);
    });
  });
}

/* ---------- 5. require 的本地模块存在 ---------- */
jsFiles.forEach((f) => {
  const src = fs.readFileSync(f, 'utf8');
  const re = /require\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const target = path.resolve(path.dirname(f), m[1]);
    const ok = fs.existsSync(target) || fs.existsSync(target + '.js') || fs.existsSync(target + '.json');
    if (!ok) fail(`${path.relative(ROOT, f)} require('${m[1]}') 找不到目标文件`);
  }
});

/* ---------- 6. WXML 检查 ---------- */
const VOID = new Set(['input', 'image', 'icon', 'progress', 'slider', 'switch', 'textarea', 'audio', 'video', 'camera', 'canvas', 'import', 'include', 'wxs']);
const wxmlFiles = files.filter((f) => f.endsWith('.wxml'));

// 内置事件属性（不绑定 JS 函数的）
const BUILTIN_ATTR = /^(wx:|data-|class$|style$|id$)/;

wxmlFiles.forEach((f) => {
  const rel = path.relative(ROOT, f);
  const src = fs.readFileSync(f, 'utf8');
  const jsPath = f.replace(/\.wxml$/, '.js');
  const jsSrc = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';

  // 6.1 标签配对
  const tagRe = /<\/?([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  const stack = [];
  let m;
  while ((m = tagRe.exec(src))) {
    const raw = m[0];
    const name = m[1];
    const selfClose = m[3] === '/';
    const isClose = raw.startsWith('</');
    // 跳过注释内的伪标签
    const before = src.slice(0, m.index);
    const lastOpen = before.lastIndexOf('<!--');
    const lastClose = before.lastIndexOf('-->');
    if (lastOpen > lastClose) continue;

    if (isClose) {
      // canvas / textarea / video 这类在 WXML 里既能自闭合也能写成开闭对
      // （官方 canvas 示例就是 <canvas ...></canvas>），所以遇到它们的闭合标签直接跳过，
      // 否则会误报「标签不配对」。
      if (VOID.has(name)) continue;
      const top = stack.pop();
      if (top !== name) {
        fail(`${rel}：标签不配对，遇到 </${name}> 但栈顶是 <${top || '空'}>`);
        break;
      }
    } else if (!selfClose && !VOID.has(name)) {
      stack.push(name);
    }
  }
  if (stack.length) fail(`${rel}：有未闭合标签 ${stack.join(' > ')}`);

  // 6.2 事件处理函数存在性
  const handlerRe = /\b(?:bind|catch|capture-bind|capture-catch)[:]?([a-zA-Z]+)\s*=\s*"([^"{}]+)"/g;
  while ((m = handlerRe.exec(src))) {
    const fn = m[2].trim();
    if (!fn || BUILTIN_ATTR.test(fn)) continue;
    const defined = new RegExp(`(^|[\\s,{])${fn}\\s*[:(]`, 'm').test(jsSrc);
    if (!defined) fail(`${rel}：绑定了 ${fn}，但 ${path.basename(jsPath)} 里没有这个函数`);
  }

  // 6.3 wx:for 嵌套必须有 wx:for-item
  const forBlocks = src.match(/wx:for=/g) || [];
  const forItem = src.match(/wx:for-item=/g) || [];
  if (forBlocks.length > 0 && forBlocks.length > 1 && forItem.length === 0) {
    fail(`${rel}：有 ${forBlocks.length} 处 wx:for 却没用 wx:for-item（嵌套时循环变量都会叫 item，内层会覆盖外层）`);
  }
  // 内层 wx:for 用了自定义 item 名，但内层内容仍写 {{item.xxx}}
  const nested = src.match(/<([a-zA-Z][\w-]*)(?:(?!<\/?\1)[\s\S])*?wx:for="\{\{[^}]+\}\}"(?:(?!<\/?\1)[\s\S])*?wx:for-item="(\w+)"([\s\S]*?)<\/\1>/g) || [];
  nested.forEach((blk) => {
    const name = (blk.match(/wx:for-item="(\w+)"/) || [])[1];
    if (!name || name === 'item') return;
    // 块内应出现 {{name.xxx}}；若只出现 {{item. 且这是最内层，可疑
    if (/\{\{item\./.test(blk) && !new RegExp(`\\{\\{${name}\\.`).test(blk)) {
      fail(`${rel}：外层块用 wx:for-item="${name}"，内部却引用 {{item.}}，会取到错误的循环变量`);
    }
  });
});

/* ---------- 7. WXSS 花括号 ---------- */
files
  .filter((f) => f.endsWith('.wxss'))
  .forEach((f) => {
    const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const open = (src.match(/\{/g) || []).length;
    const close = (src.match(/\}/g) || []).length;
    if (open !== close) fail(`${path.relative(ROOT, f)}：花括号不配对（{ ${open} 个，} ${close} 个）`);
  });

/* ---------- 8. 包体积 ----------
   分包里的文件不计入主包。语音音频放在 assets 分包，所以加语音之后主包体积
   应该和之前一样 —— 如果这里算成主包体积，会误报超限，逼着人去做没必要的重构。 */
const sizeOf = (list) => list.reduce((s, f) => s + fs.statSync(f).size, 0);
const subs = (appJson && (appJson.subpackages || appJson.subPackages)) || [];
const subRoots = subs.map((s) => ({ name: s.name || s.root, dir: path.join(MP, s.root) + path.sep }));

const mainFiles = [];
const subBuckets = {};
files.filter((f) => !f.includes('node_modules')).forEach((f) => {
  const hit = subRoots.find((r) => f.startsWith(r.dir));
  if (hit) (subBuckets[hit.name] = subBuckets[hit.name] || []).push(f);
  else mainFiles.push(f);
});

const totalKB = sizeOf(mainFiles) / 1024;
const subKB = {};
Object.keys(subBuckets).forEach((k) => { subKB[k] = sizeOf(subBuckets[k]) / 1024; });

if (totalKB > 2048) fail(`主包 ${totalKB.toFixed(1)} KB 超过 2048 KB 上限`);
Object.keys(subKB).forEach((k) => {
  if (subKB[k] > 2048) fail(`分包 ${k} ${subKB[k].toFixed(1)} KB 超过单包 2048 KB 上限`);
});
const allKB = totalKB + Object.keys(subKB).reduce((s, k) => s + subKB[k], 0);
if (allKB > 20480) fail(`总包 ${allKB.toFixed(1)} KB 超过 20480 KB 上限`);

// 分包配置里的 page 必须四件套齐全（分包缺 page 会让整个分包加载失败）
subs.forEach((s) => {
  (s.pages || []).forEach((p) => {
    const base = path.join(MP, s.root, p);
    ['.js', '.json', '.wxml'].forEach((ext) => {
      if (!fs.existsSync(base + ext)) fail(`分包 ${s.name} 的页面缺文件：${path.relative(MP, base + ext)}`);
    });
  });
});

/* ---------- 输出 ---------- */
console.log('==== 小程序静态检查 ====');
console.log(`  文件 ${files.length} 个｜JS ${jsFiles.length}｜JSON ${jsonFiles.length}｜WXML ${wxmlFiles.length}`);
console.log(`  主包 ${totalKB.toFixed(1)} KB（上限 2048，占 ${((totalKB / 2048) * 100).toFixed(1)}%）`);
Object.keys(subKB).forEach((k) => {
  console.log(`  分包 ${k} ${subKB[k].toFixed(1)} KB（上限 2048，占 ${((subKB[k] / 2048) * 100).toFixed(1)}%）`);
});

if (fails.length) {
  console.log(`\n❌ ${fails.length} 处问题：`);
  fails.forEach((f) => console.log('   · ' + f));
  process.exit(1);
}
console.log('\n✅ 静态检查通过');
