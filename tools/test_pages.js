#!/usr/bin/env node
/**
 * test_pages.js —— 用 Node 模拟小程序运行时，把 5 个页面真跑一遍
 *
 * 为什么需要：本机没有微信开发者工具，静态检查只能保证"语法和标签没错"，
 * 抓不到运行时的 undefined、setData 路径错误、事件参数取错这类问题。
 * 这里实现一个极简运行时（Page / wx / getApp / setData 路径赋值），
 * 加载真实页面代码并驱动真实交互流程，断言数据变化。
 *
 * 覆盖：
 *   首页   按册分组、切换册、进度回显
 *   学习页 讲解模式揭示答案 / 练习模式作答+判分+错题入本 / 解答题自评
 *   错题本 分组、展开、移除
 *   报告页 正确率、薄弱点、单元掌握度
 *   教师端 内容覆盖统计、复制文本
 *
 * 用法：node tools/test_pages.js
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');

const fails = [];
const ok = (cond, msg) => {
  if (!cond) fails.push(msg);
};
const eq = (a, b, msg) => ok(a === b, `${msg}（期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)}）`);

/* ================= 极简小程序运行时 ================= */

let pageDef = null;      // 当前 Page({...}) 的定义
let appDef = null;       // App({...})
const storage = {};

// 支持 'node.questions[0].selected' 这种路径写值
function setPath(obj, keyPath, value) {
  const parts = keyPath.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null) cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function makeInstance(def) {
  const inst = Object.assign({}, def);
  inst.data = JSON.parse(JSON.stringify(def.data || {}));
  inst.setData = function (patch, cb) {
    Object.keys(patch).forEach((k) => setPath(inst.data, k, patch[k]));
    if (typeof cb === 'function') cb();
  };
  return inst;
}

// 装一个模块级沙箱：注入 Page / App / wx / getApp
function loadPage(relPath) {
  pageDef = null;
  const full = path.join(MP, relPath);
  delete require.cache[require.resolve(full)];
  require(full);
  if (!pageDef) throw new Error(`${relPath} 没有调用 Page()`);
  return makeInstance(pageDef);
}

global.Page = (def) => { pageDef = def; };
global.App = (def) => { appDef = def; };
global.getApp = () => appDef;

const toastLog = [];
const redirectLog = [];
const modalLog = [];
const titleLog = [];
const scrollLog = [];
const navLog = [];
global.wx = {
  getStorageSync: (k) => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: (k) => { delete storage[k]; },
  showToast: (o) => toastLog.push(o.title),
  showModal: (o) => { modalLog.push(o.title); o.success && o.success({ confirm: true }); },
  showLoading: () => {},
  hideLoading: () => {},
  navigateTo: (o) => { navLog.push(o.url); },
  navigateBack: () => {},
  redirectTo: (o) => { redirectLog.push(o.url); },
  pageScrollTo: (o) => { scrollLog.push(o); },
  setNavigationBarTitle: (o) => { titleLog.push(o.title); },
  setClipboardData: (o) => { storage.__clipboard = o.data; },
  cloud: null
};

/* 先加载 app.js 得到 globalData（cloudOn = false，本机模式） */
require(path.join(MP, 'app.js'));
appDef.onLaunch();

const content = require(path.join(MP, 'data', 'content.js'));

/* ================= 1. 内容数据 ================= */
console.log('==== 内容数据 ====');
eq(content.nodes.length, 493, '知识点总数');
eq(content.nodes.reduce((s, n) => s + n.questions.length, 0), 1972, '题目总数');
eq(content.books.length, 12, '册数');
content.nodes.forEach((n) => {
  ok(n.storyHtml && n.storyHtml.length > 40, `${n.id} storyHtml 过短`);
  ok(n.wrongTip && n.wrongTip.length > 6, `${n.id} wrongTip 过短`);
  ok(n.questions.length >= 3 && n.questions.length <= 4, `${n.id} 题数异常`);
  n.questions.forEach((q) => {
    ok(q.stem && q.stem.length > 4, `${q.id} 题干过短`);
    ok(q.answer, `${q.id} 无答案`);
    ok(q.analysis && q.analysis.length > 4, `${q.id} 无解析`);
    if (q.type === 'choice') ok(Array.isArray(q.options) && q.options.length >= 2, `${q.id} 选择题无选项`);
  });
});
console.log(`  ${content.nodes.length} 知识点 / ${content.nodes.reduce((s, n) => s + n.questions.length, 0)} 题 结构完整`);

/* ================= 2. 首页 ================= */
console.log('\n==== 首页 ====');
const index = loadPage('pages/index/index.js');
index.onLoad();
eq(index.data.books.length, 12, '册切换项数量');
eq(index.data.bookKey, 'g1s', '无历史选择时默认第一册（一年级上册）');
eq(index.data.cloudOn, false, '未配云环境时 cloudOn 应为 false');

index.onShow();
eq(index.data.nodeCount, 34, '一年级上册知识点数');
eq(index.data.questionCount, 136, '一年级上册题目数');
eq(index.data.groups.length, 10, '一年级上册单元数');
ok(index.data.groups.every((g, i, arr) => i === 0 || g.seq >= arr[i - 1].seq), '单元分组未按 unitSeq 升序');
ok(index.data.groups[0].nodes.length > 0, '首个单元无知识点');

// 切换册
index.switchBook({ currentTarget: { dataset: { key: 'g3x' } } });
eq(index.data.nodeCount, 43, '三年级下册知识点数');
eq(index.data.questionCount, 172, '三年级下册题目数');
eq(index.data.groups.length, 11, '三年级下册单元数');
eq(storage.lastBook, 'g3x', '切换册后应记住选择');

index.switchBook({ currentTarget: { dataset: { key: 'g3s' } } });
eq(index.data.nodeCount, 37, '三年级上册知识点数');
eq(index.data.questionCount, 148, '三年级上册题目数');

index.switchBook({ currentTarget: { dataset: { key: 'g2s' } } });
eq(index.data.nodeCount, 40, '二年级上册知识点数');
eq(index.data.questionCount, 160, '二年级上册题目数');

// 回到上次选择：重新进入首页应落在 g2s（最后一次切换）
const index2 = loadPage('pages/index/index.js');
index2.onLoad();
eq(index2.data.bookKey, 'g2s', '重新进入应恢复上次选的册');

// 两列下拉（年级 / 上下册）：12 册不用滚一长条，两下点到任意一册
eq(index2.data.bookRange.length, 2, '下拉应为两列');
eq(index2.data.bookRange[0].length, 6, '年级列应有 6 项');
eq(index2.data.bookRange[0][3], '四年级', '年级列第 4 项');
eq(index2.data.bookRange[1].join('/'), '上册/下册', '册次列');
eq(index2.data.bookLabels.length, 12, '展示文案仍按册数 12 条');
ok(index2.data.bookLabels[6].indexOf('四年级上册') === 0, '第 7 条文案应以「四年级上册」开头');
ok(/讲$/.test(index2.data.bookLabels[6]), '文案应带讲数，如「四年级上册 · 46 讲」');

// 当前停在 g2s（二年级上册）→ 下拉位置应为 [1, 0]
eq(index2.data.bookValue.join(','), '1,0', '下拉位置应指向二年级上册');

// 滚到「六年级」（只动第 0 列，第 1 列保持）
index2.onColumnChange({ detail: { column: 0, value: 5 } });
eq(index2.data.bookValue.join(','), '5,0', '滚动年级列后位置同步');

// 确定：picker 回传字符串下标数组，选「五年级下册」= [4, 1]
index2.onPickBook({ detail: { value: ['4', '1'] } });
eq(index2.data.bookIndex, 9, '五年级下册在 books 里是第 10 项');
eq(index2.data.bookKey, 'g5x', '下拉选「五年级下册」');
eq(index2.data.nodeCount, 38, '五年级下册知识点数');
eq(index2.data.bookValue.join(','), '4,1', '选完后下拉位置应回到 [4,1]');
eq(storage.lastBook, 'g5x', '下拉选完应记住选择');

// 12 册逐册都能渲染，且计数与 content.books 的 nodeCount 一致
content.books.forEach((b) => {
  index.switchBook({ currentTarget: { dataset: { key: b.key } } });
  eq(index.data.nodeCount, b.nodeCount, `${b.title} 知识点数`);
  ok(index.data.groups.length > 0, `${b.title} 未分到单元`);
});

// 导航栏标题必须跟着当前册走（曾经写死在 index.json 里，12 册全都显示「三年级 · 时、分、秒」）
titleLog.length = 0;
index.switchBook({ currentTarget: { dataset: { key: 'g1s' } } });
eq(titleLog[titleLog.length - 1], '一年级上册 · 34 讲', '标题应跟着切到一年级上册');
index.switchBook({ currentTarget: { dataset: { key: 'g6x' } } });
eq(titleLog[titleLog.length - 1], '六年级下册 · 27 讲', '标题应跟着切到六年级下册');

/* ================= 2.5 单元索引条 ================= */
console.log('\n==== 单元索引条 ====');
const ui = loadPage('pages/index/index.js');
ui.onLoad();
ui.switchBook({ currentTarget: { dataset: { key: 'g1s' } } });
eq(ui.data.groups.length, 10, '一年级上册单元数');

// 短名规则：有编号取序号，特殊单元保留词本身
eq(ui.data.groups[1].short, '一', '「第一单元 …」应缩成「一」');
eq(ui.data.groups[2].short, '二', '「第二单元 …」应缩成「二」');
eq(ui.data.groups[0].short, '我上学啦', '无编号单元保留原名');
eq(ui.data.groups[3].short, '综合1', '第一个「综合实践」缩成「综合1」');
eq(ui.data.groups[9].short, '复习', '「总复习」应缩成「复习」');
ok(ui.data.groups.every((g) => g.short && g.short.length <= 4), '短名一律不超过 4 字');
// 索引条上不能有重名，否则两个「综合」分不出是哪个单元
const shorts = ui.data.groups.map((g) => g.short);
eq(new Set(shorts).size, shorts.length, '同一册内短名必须互不相同');
eq(shorts.filter((s) => /^综合/.test(s)).length, 2, '一年级上册有两个综合实践');

// 点索引 → 滚到对应单元，并给吸顶条留出偏移
scrollLog.length = 0;
ui.jumpUnit({ currentTarget: { dataset: { seq: 4 } } });
eq(scrollLog.length, 1, '点单元索引应触发滚动');
eq(scrollLog[0].selector, '#u4', '应滚到第四单元的锚点');
eq(scrollLog[0].offsetTop, -74, '偏移量为负且不小于索引条高度，避免标题被吸顶条盖住');
eq(ui.data.activeSeq, 4, '跳转后高亮同步到这个单元');

// 滚动时高亮自动跟着走（用假的单元位置模拟布局）
ui._unitTop = [0, 300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700];
ui.onPageScroll({ scrollTop: 0 });
eq(ui.data.activeSeq, 1, '在顶部时应高亮第一单元');
ui.onPageScroll({ scrollTop: 620 });
eq(ui.data.activeSeq, 3, '滚过第三个单元标题后应高亮第三单元');
ui.onPageScroll({ scrollTop: 5000 });
eq(ui.data.activeSeq, 10, '滚到最底应高亮最后一个单元');
console.log('  单元数/短名规则/点击跳转/滚动高亮 全部正确');

// 缺册保护：将来若某年级只出一册，滚到「该年级+缺的那册」必须被纠正，不能落到空册
const idx3 = loadPage('pages/index/index.js');
idx3.onLoad();
idx3.setData({ books: idx3.data.books.filter((b) => b.key !== 'g6x') }); // 人为删掉六年级下册
idx3.onColumnChange({ detail: { column: 0, value: 5 } }); // 滚到六年级，此时册次是上册
eq(idx3.data.bookValue.join(','), '5,0', '滚到六年级应停在六年级上册');
idx3.onColumnChange({ detail: { column: 1, value: 1 } }); // 想选下册，但这一年级没有
eq(idx3.data.bookValue.join(','), '5,0', '缺册时应回退到该年级实际有的册');
const keyBefore = idx3.data.bookKey;
idx3.onPickBook({ detail: { value: ['5', '1'] } }); // 强行确认缺册组合
eq(idx3.data.bookKey, keyBefore, '确认缺册组合不应切册');
console.log('  分组/两列下拉/切换册/计数/记忆选择/缺册保护 全部正确');

/* ================= 3. 学习页 · 讲解模式 ================= */
console.log('\n==== 学习页（讲解模式）====');
const teach = loadPage('pages/learn/learn.js');
teach.onLoad({ id: 'bsd-g3s-001', mode: 'teach' });
eq(teach.data.mode, 'teach', '模式');
eq(teach.data.storyOpen, true, '讲解模式故事应默认展开');
eq(teach.data.node.questions.length, 4, '知识点 1 题数');
ok(teach.data.node.questions.every((q) => q.reveal === false), '初始不应揭示答案');
ok(teach.data.node.questions[0].levelText === '基础', 'Q1 层次标签');

teach.reveal({ currentTarget: { dataset: { idx: 0 } } });
eq(teach.data.node.questions[0].reveal, true, '单题揭示');
eq(teach.data.node.questions[1].reveal, false, '其他题不应被揭示');

teach.revealAll();
ok(teach.data.node.questions.every((q) => q.reveal), '全部揭示');
console.log('  故事展开/单题揭示/全部揭示 正确');

/* ================= 3.5 同册翻页 ================= */
console.log('\n==== 同册翻页 ====');
// 册首：没有上一节，有下一节
eq(teach.data.pos, 1, '三年级上册第 1 节序号');
eq(teach.data.posTotal, 37, '三年级上册总节数');
eq(teach.data.prevId, '', '册首不应有上一节');
eq(teach.data.nextId, 'bsd-g3s-002', '第 1 节的下一节');

// 整册逐节核对 prev/next/序号：翻页必须按 order 排、且跨单元连续
const g3sList = content.nodes.filter((n) => n.book === 'g3s').sort((a, b) => a.order - b.order);
g3sList.forEach((n, i) => {
  const p = loadPage('pages/learn/learn.js');
  p.onLoad({ id: n.id, mode: 'teach' });
  eq(p.data.prevId, i > 0 ? g3sList[i - 1].id : '', `${n.id} 的上一节`);
  eq(p.data.nextId, i < g3sList.length - 1 ? g3sList[i + 1].id : '', `${n.id} 的下一节`);
  eq(p.data.pos, i + 1, `${n.id} 的序号`);
});

// 跨单元边界：上一节与下一节应分属不同单元，但仍然是相邻两节
const crossUnit = g3sList.find((n, i) => i > 0 && g3sList[i - 1].unitSeq !== n.unitSeq);
ok(!!crossUnit, '应能找到一个单元起始节');
if (crossUnit) {
  const c = loadPage('pages/learn/learn.js');
  c.onLoad({ id: crossUnit.id, mode: 'teach' });
  const prevNode = content.nodes.find((x) => x.id === c.data.prevId);
  ok(prevNode.unitSeq !== crossUnit.unitSeq, '单元首节的上一节应属上一单元');
  eq(c.data.nextId, g3sList[g3sList.indexOf(crossUnit) + 1].id, '单元首节的下一节');
}

// 册末：没有下一节
const g3sLast = g3sList[g3sList.length - 1];
const lastPage = loadPage('pages/learn/learn.js');
lastPage.onLoad({ id: g3sLast.id, mode: 'teach' });
eq(lastPage.data.nextId, '', '册末不应有下一节');
eq(lastPage.data.pos, g3sList.length, '册末序号');

// 点击行为：册首点「上一节」不跳，点「下一节」用 redirectTo 带同样的模式
redirectLog.length = 0;
teach.goPrev();
eq(redirectLog.length, 0, '册首点上一节不应跳转');
teach.goNext();
eq(redirectLog[0], '/pages/learn/learn?id=bsd-g3s-002&mode=teach', '下一节跳转地址应带 id 与 mode');

// 练习模式写了答案但没提交：先问一句，别让学生白写
const pracJump = loadPage('pages/learn/learn.js');
pracJump.onLoad({ id: 'bsd-g3s-005', mode: 'practice' });
redirectLog.length = 0;
modalLog.length = 0;
pracJump.goNext();
eq(redirectLog.length, 1, '没作答时应直接翻页');
eq(modalLog.length, 0, '没作答时不该弹确认');

redirectLog.length = 0;
modalLog.length = 0;
pracJump.onFill({ currentTarget: { dataset: { idx: 0 } }, detail: { value: '写了点什么' } });
pracJump.goNext();
eq(modalLog.length, 1, '有未提交作答时应弹确认');
eq(redirectLog.length, 1, '确认后仍应翻页（桩里自动点确定）');
// 本单元位置：老师要看的是「这个单元还剩几节」，整册序号对他没意义
const u1Nodes = g3sList.filter((n) => n.unitSeq === g3sList[0].unitSeq);
const uFirst = loadPage('pages/learn/learn.js');
uFirst.onLoad({ id: u1Nodes[0].id, mode: 'teach' });
eq(uFirst.data.unitPos, 1, '单元首节在本单元排第 1');
eq(uFirst.data.unitTotal, u1Nodes.length, '本单元总节数');
const uLast = loadPage('pages/learn/learn.js');
uLast.onLoad({ id: u1Nodes[u1Nodes.length - 1].id, mode: 'teach' });
eq(uLast.data.unitPos, u1Nodes.length, '单元末节在本单元排第几个');
// 两个数字必须是分开算的：跨单元后整册序号继续涨，本单元序号归 1
eq(uLast.data.pos, u1Nodes.length, '第一单元末节的整册序号等于单元长度（第一单元从第 1 节开始）');
const u2First = g3sList.find((n) => n.unitSeq !== g3sList[0].unitSeq);
const u2Page = loadPage('pages/learn/learn.js');
u2Page.onLoad({ id: u2First.id, mode: 'teach' });
eq(u2Page.data.unitPos, 1, '第二单元首节的本单元序号应归 1');
ok(u2Page.data.pos > 1, '第二单元首节的整册序号应大于 1');
console.log('  上一节/下一节/跨单元/册首册末/未提交保护/本单元位置 正确');

/* ================= 3.6 讲过 / 练过 / 继续上次 ================= */
console.log('\n==== 讲过 / 练过 / 继续上次 ====');
delete storage.taught;
delete storage.lastNode;
delete storage.progress;

// 练习模式不算「讲过」：学生自己刷题，不代表老师讲过这一节
const pv = loadPage('pages/learn/learn.js');
pv.onLoad({ id: 'bsd-g3s-003', mode: 'practice' });
ok(!storage.taught || !storage.taught['bsd-g3s-003'], '练习模式不该写 taught（否则「已讲 x/y」会虚高）');
eq(storage.lastNode['g3s'], 'bsd-g3s-003', '练习模式也要更新「上次讲到」');

// 讲解模式算「讲过」
const tv = loadPage('pages/learn/learn.js');
tv.onLoad({ id: 'bsd-g3s-004', mode: 'teach' });
eq(storage.taught['bsd-g3s-004'], 1, '讲解模式应记 taught');
eq(storage.lastNode['g3s'], 'bsd-g3s-004', 'lastNode 应跟着更新到最新一节');
eq(storage.lastNode['g1s'], undefined, '别的册不该被顺带写入（按册各存一条）');

// 首页三态 + 单元已讲数 + 继续上次
storage.lastBook = 'g3s';
storage.taught = { 'bsd-g3s-001': 1, 'bsd-g3s-002': 1 };
storage.progress = {
  'bsd-g3s-003': { v: 2, autoCorrect: 3, autoTotal: 3, selfCorrect: 1, selfTotal: 1, correct: 3, total: 3 }
};
storage.lastNode = { g3s: 'bsd-g3s-002' };
const home = loadPage('pages/index/index.js');
home.onLoad();
home.onShow();

const pick = (id) => home.data.groups.reduce((a, g) => a.concat(g.nodes), []).find((n) => n.id === id);
eq(pick('bsd-g3s-001').state, 'taught', '只讲过 → taught 态');
eq(pick('bsd-g3s-003').state, 'done', '练过 → done 态（绿点优先，不能同时是蓝点）');
eq(pick('bsd-g3s-003').score, '上次 3/3', '首页只显示机器判分分数，不显示含自评的 4/4');
eq(pick('bsd-g3s-005').state, '', '没动过 → 空态');
eq(pick('bsd-g3s-003').seen, false, '只练过没讲过时 seen 应为 false');
eq(home.data.groups[0].taughtCount, 2, '第一单元已讲 2 节');
eq(home.data.groups[1].taughtCount, 0, '第二单元一节都没讲');
ok(home.data.groups[0].taughtCount < home.data.groups[0].nodes.length, '未讲完时不能等于单元总节数');

eq(home.data.resume.id, 'bsd-g3s-002', '继续上次应指向 lastNode');
eq(home.data.resume.pos, 2, '继续上次的整册序号');
eq(home.data.resume.total, 37, '继续上次的整册总节数');
eq(home.data.resume.title, content.nodes.find((n) => n.id === 'bsd-g3s-002').title, '继续上次的标题');

navLog.length = 0;
home.goResume();
eq(navLog[0], '/pages/learn/learn?id=bsd-g3s-002&mode=teach', '继续上次应直接进讲解模式');

// 切到从没讲过的册：横条必须消失，不能还提示另一册的进度
home.switchBook({ currentTarget: { dataset: { key: 'g1s' } } });
eq(home.data.resume, null, '切到没讲过的册，「继续上次」应消失');
console.log('  三态/单元已讲数/继续上次/换册清空 全部正确');

/* ================= 3.5 动画讲解 ================= */
console.log('\n==== 动画讲解 ====');
// 配了场景的知识点：讲解模式应带出动画信息
const animPage = loadPage('pages/learn/learn.js');
animPage.onLoad({ id: 'bsd-g1s-010', mode: 'teach' });
eq(animPage.data.animId, 'addMeaning', '加法意义应挂 addMeaning 场景');
ok(animPage.data.animTitle.length > 0, '动画标题应非空');
ok(animPage.data.animLen > 0, '动画时长应 >0');
eq(animPage.data.animOpen, true, '动画默认展开');
eq(animPage.data.animProgress, 0, '初始进度应为 0');
eq(animPage.data.playing, false, '初始不应在播放');
eq(animPage.data.animLine, '', '未播放时字幕应为空');
eq(animPage.data.animLineIdx, -1, '未播放时字幕索引应为 -1');
eq(animPage.data.audioOn, false, '语音分包未就绪时 audioOn 应为 false');

// 动画时长必须跟着旁白走 —— 声音讲完了画面还在动、或者画面停了声音还在讲，都是错的
const animDur = require('../miniprogram/utils/anim/engine.js').duration('addMeaning');
const narrTotal = require('../miniprogram/utils/anim/narration.js').NARRATION.addMeaning.total;
eq(animDur, narrTotal, '动画时长应等于旁白总时长');

// 概念性知识点（无法直接运算）：走 conceptCard 兜底 + 云端语音（按需下载）
const conceptPage = loadPage('pages/learn/learn.js');
conceptPage.onLoad({ id: 'bsd-g1s-003', mode: 'teach' });
eq(conceptPage.data.animId, 'conceptCard', '概念性知识点应走 conceptCard 兜底');
eq(conceptPage.data.animTitle, '本节要点', '概念卡标题应为「本节要点」');
eq(conceptPage.data.animAudioKind, 'cloud', '概念卡语音走云端（分包装不下 61MB）');
eq(conceptPage.data.animHasAudio, true, '概念卡已配云端语音');
eq(conceptPage.data.animNarration.lines.length, 5, '概念卡应 5 句（标题/要点1/要点2/易错/鼓励）');
eq(conceptPage.data.animNarration.lines[0].file, '', '下载前 file 应为空，此时是纯字幕');
eq(conceptPage.data.audioOn, false, '音频没就绪前 audioOn 应为 false（UI 显示「字幕模式」）');
// 云端没配 / 没网时必须安全落回字幕，不能抛
let prefetchThrew = false;
try { conceptPage.prefetchCloudAudio(); } catch (e) { prefetchThrew = true; }
eq(prefetchThrew, false, '云端不可用时 prefetchCloudAudio 不应抛异常');

// 运算节点与旗舰节点：语音在分包里，audioKind 必须区分开，否则会去 load 错分包
const opPage = loadPage('pages/learn/learn.js');
opPage.onLoad({ id: 'bsd-g3s-023', mode: 'teach' });
eq(opPage.data.animAudioKind, 'subpackage', '运算节点语音在分包里');
eq(animPage.data.animAudioKind, 'subpackage', '旗舰节点语音在分包里');

// 练习模式默认收起：做题前先看动画等于看答案
const animPrac = loadPage('pages/learn/learn.js');
animPrac.onLoad({ id: 'bsd-g1s-010', mode: 'practice' });
eq(animPrac.data.animOpen, false, '练习模式动画应默认收起');

// 没有 canvas 能力时（Node 模拟环境）点播放/收起不能崩
animPage.togglePlay();
eq(animPage.data.playing, false, '无 canvas 时点播放应安全返回');
animPage.toggleAnim();
eq(animPage.data.animOpen, false, '收起动画区');
animPage.replayAnim();
eq(animPage.data.animProgress, 0, '重播后进度归零');
console.log('  场景挂载/无场景降级/练习模式收起/无 canvas 安全返回 正确');

/* ================= 4. 学习页 · 练习模式 ================= */
console.log('\n==== 学习页（练习模式）====');
const prac = loadPage('pages/learn/learn.js');
prac.onLoad({ id: 'bsd-g3s-001', mode: 'practice' });
eq(prac.data.mode, 'practice', '模式');
eq(prac.data.storyOpen, false, '练习模式故事应默认收起');

const qs = prac.data.node.questions;
const autoList = qs.filter((q) => q.type !== 'solve');
eq(prac.data.autoTotal, autoList.length, '可自动批改题数（= 非解答题数）');
eq(prac.data.selfTotal, qs.length - autoList.length, '自评题数（= 解答题数）');
eq(prac.data.total, qs.length, '总题数');

// 按题号设定：第 1 题对、第 2 题错、第 3 题对、（第 4 题若为解答题则不参与自动判定）
const SHOULD_RIGHT = [true, false, true, false];
qs.forEach((q, i) => {
  if (q.type === 'solve') return; // 解答题提交后再自评
  let val;
  if (SHOULD_RIGHT[i]) {
    val = q.answer;
  } else if (q.type === 'choice') {
    val = (q.options.find((o) => o.charAt(0) !== q.answer) || q.options[0]).charAt(0);
  } else if (q.type === 'judge') {
    val = q.answer === '对' ? '错' : '对';
  } else {
    val = '999';
  }
  if (q.type === 'choice' || q.type === 'judge') {
    prac.choose({ currentTarget: { dataset: { idx: i, val } } });
  } else {
    prac.onFill({ currentTarget: { dataset: { idx: i } }, detail: { value: val } });
  }
});
prac.submit();

const expectCorrect = autoList.filter((q, i) => SHOULD_RIGHT[qs.indexOf(q)]).length;
eq(prac.data.submitted, true, '提交后 submitted');
eq(prac.data.autoCorrect, expectCorrect, '自动批改正确数');
ok(prac.data.node.questions[0].judged !== 'no', '第 1 题应判对');
ok(prac.data.node.questions[1].judged === 'no', '第 2 题应判错');
ok(prac.data.node.questions[1].reveal === true, '提交后应自动显示解析');

const progress = storage.progress || {};
const rec1 = progress['bsd-g3s-001'];
ok(rec1, '进度已写入本地');
eq(rec1.v, 2, '成绩记录应带口径版本 v:2');
eq(rec1.autoCorrect, expectCorrect, '机器判分正确数');
eq(rec1.autoTotal, autoList.length, '机器判分总题数（不含解答题）');
eq(rec1.selfTotal, qs.length - autoList.length, '自评题数单独存');
eq(rec1.correct, rec1.autoCorrect, '兼容别名 correct 只指机器判分，绝不含自评');
eq(rec1.total, rec1.autoTotal, '兼容别名 total 只指机器判分');

// 错题本：应记下所有自动判错的题
const wrongCountExpect = autoList.filter((q) => SHOULD_RIGHT[qs.indexOf(q)] === false).length;
const wrongBook = storage.wrongBook || [];
eq(wrongBook.length, wrongCountExpect, '错题本应记下全部判错题');
ok(wrongBook.every((w) => w.answer && w.analysis && w.nodeTitle), '错题条目应带答案/解析/知识点名');
console.log(`  作答→判分→进度→错题本 全链路正确（自动批改 ${prac.data.autoCorrect}/${autoList.length}，错题 ${wrongBook.length} 道）`);

/* ================= 5. 解答题自评 ================= */
console.log('\n==== 解答题自评 ====');
// 找一个含 solve 的知识点
const solveNode = content.nodes.find((n) => n.questions.some((q) => q.type === 'solve'));
ok(!!solveNode, '应存在含解答题的知识点');
if (solveNode) {
  const p2 = loadPage('pages/learn/learn.js');
  p2.onLoad({ id: solveNode.id, mode: 'practice' });
  eq(p2.data.selfTotal, solveNode.questions.filter((q) => q.type === 'solve').length, '自评题数');
  p2.data.node.questions.forEach((q, i) => {
    if (q.type === 'solve') return;
    const val = q.type === 'choice' || q.type === 'judge' ? q.answer : q.answer;
    if (q.type === 'choice' || q.type === 'judge') p2.choose({ currentTarget: { dataset: { idx: i, val } } });
    else p2.onFill({ currentTarget: { dataset: { idx: i } }, detail: { value: val } });
  });
  p2.submit();
  const solveIdx = p2.data.node.questions.findIndex((q) => q.type === 'solve');
  p2.selfJudge({ currentTarget: { dataset: { idx: solveIdx, mark: 'ok' } } });
  eq(p2.data.selfCorrect, 1, '自评写对后 selfCorrect');
  eq(p2.data.node.questions[solveIdx].selfMark, 'ok', '自评标记');
  // 再点一次同样的不应重复加分
  p2.selfJudge({ currentTarget: { dataset: { idx: solveIdx, mark: 'ok' } } });
  eq(p2.data.selfCorrect, 1, '重复点同一边不重复加分');
  // 改判为错
  p2.selfJudge({ currentTarget: { dataset: { idx: solveIdx, mark: 'no' } } });
  eq(p2.data.selfCorrect, 0, '改判为错后应扣回');
  console.log('  自评加减分/去重/改判 正确');
}

/* ================= 6. 错题本 ================= */
console.log('\n==== 错题本 ====');
const wrong = loadPage('pages/wrong/wrong.js');
wrong.onShow();
ok(wrong.data.count >= 2, '错题数应 ≥2');
ok(wrong.data.groups.length >= 1, '错题应有分组');
ok(wrong.data.groups[0].items[0].answer, '错题卡应能取到答案');
const firstQid = wrong.data.groups[0].items[0].questionId;
wrong.toggle({ currentTarget: { dataset: { id: firstQid } } });
eq(wrong.data.openId, firstQid, '展开指定题');
wrong.toggle({ currentTarget: { dataset: { id: firstQid } } });
eq(wrong.data.openId, '', '再点收起');
const before = wrong.data.count;
wrong.remove({ currentTarget: { dataset: { id: firstQid } } });
eq(wrong.data.count, before - 1, '移除后数量减 1');
console.log('  分组/展开收起/移除 正确');

/* ================= 6.5 正确率口径：自评绝不进分母 ================= */
console.log('\n==== 正确率口径 ====');
{
  const savedProgress = storage.progress;
  const savedWrong = storage.wrongBook;
  storage.progress = {};
  storage.wrongBook = [];

  // 未提交就点自评，不该凭空造出一条 autoCorrect=0 的成绩记录
  const pNo = loadPage('pages/learn/learn.js');
  pNo.onLoad({ id: solveNode.id, mode: 'practice' });
  const noIdx = pNo.data.node.questions.findIndex((q) => q.type === 'solve');
  pNo.selfJudge({ currentTarget: { dataset: { idx: noIdx, mark: 'ok' } } });
  eq(Object.keys(storage.progress).length, 0, '未提交时点自评不应写 progress');
  eq((storage.wrongBook || []).length, 0, '自评「会了」不该进错题本');

  // 核心反例：机器判分题全错，解答题全自评「我会了」。
  // 旧口径会把自评算进来，甚至刷出「扎实」；新口径必须老实显示 0%。
  const p3 = loadPage('pages/learn/learn.js');
  p3.onLoad({ id: 'bsd-g3s-001', mode: 'practice' });
  const qs3 = p3.data.node.questions;
  qs3.forEach((q, i) => {
    if (q.type === 'solve') return;
    const val = q.type === 'choice'
      ? (q.options.find((o) => o.charAt(0) !== q.answer) || q.options[0]).charAt(0)
      : q.type === 'judge' ? (q.answer === '对' ? '错' : '对') : '999';
    if (q.type === 'choice' || q.type === 'judge') {
      p3.choose({ currentTarget: { dataset: { idx: i, val } } });
    } else {
      p3.onFill({ currentTarget: { dataset: { idx: i } }, detail: { value: val } });
    }
  });
  p3.submit();
  const solveIdxs = qs3.map((q, i) => (q.type === 'solve' ? i : -1)).filter((i) => i >= 0);
  ok(solveIdxs.length > 0, '该知识点应含解答题，反例才成立');
  solveIdxs.forEach((i) => p3.selfJudge({ currentTarget: { dataset: { idx: i, mark: 'ok' } } }));
  eq(p3.data.autoCorrect, 0, '反例：机器判分题全错');
  eq(p3.data.selfCorrect, solveIdxs.length, '反例：解答题全自评「会了」');
  const r3 = storage.progress['bsd-g3s-001'];
  eq(r3.correct, 0, '反例：落盘 correct 不能被自评抬高');
  eq(r3.selfCorrect, solveIdxs.length, '反例：自评数单独存');

  const rp3 = loadPage('pages/report/report.js');
  rp3.onShow();
  eq(rp3.data.stat.rate, 0, '反例：正确率必须是 0%，自评全勾对不能刷分');
  eq(rp3.data.stat.level, '要重讲', '反例：等级不能变成「扎实」');
  eq(rp3.data.stat.selfTotal, solveIdxs.length, '自评题数单列展示');
  ok(rp3.data.stat.hasAuto, '有判分题时应显示正确率');

  // 旧记录（无 v:2，correct 混过自评）排除出正确率，但仍算「练过」
  storage.progress['bsd-g3s-002'] = { correct: 4, total: 4 };
  const rp4 = loadPage('pages/report/report.js');
  rp4.onShow();
  eq(rp4.data.stat.qTotal, r3.autoTotal, '旧记录不能进正确率分母');
  eq(rp4.data.stat.qCorrect, 0, '旧记录不能进正确率分子');
  eq(rp4.data.stat.legacyCount, 1, '旧口径记录应计数并提示重做');
  eq(rp4.data.stat.nodesDone, 2, '旧记录仍算「练过」的知识点');
  const tc4 = loadPage('pages/teacher/teacher.js');
  tc4.onShow();
  eq(tc4.data.local.rate, 0, '教师端正确率同口径');
  eq(tc4.data.local.legacyCount, 1, '教师端也提示旧记录');

  // 整册只有自评时，不能显示「0% 要重讲」这种假结论
  storage.progress = {
    'bsd-g3s-003': { v: 2, autoCorrect: 0, autoTotal: 0, selfCorrect: 2, selfTotal: 2, correct: 0, total: 0 }
  };
  const rp5 = loadPage('pages/report/report.js');
  rp5.onShow();
  eq(rp5.data.stat.hasAuto, false, '没有判分题时不应显示正确率');
  eq(rp5.data.units.length, 0, '没有判分题的单元不参与排名');
  eq(rp5.data.stat.selfTotal, 2, '自评题数仍应展示');

  storage.progress = savedProgress;
  storage.wrongBook = savedWrong;
  console.log('  自评全勾对不刷分 / 旧记录排除 / 纯自评不显示假正确率 正确');
}

/* ================= 7. 学习报告 ================= */
console.log('\n==== 学习报告 ====');
const report = loadPage('pages/report/report.js');
report.onShow();
eq(report.data.empty, false, '有记录时不应为空');
ok(report.data.stat.qTotal > 0, '总题数应 >0');
ok(report.data.stat.rate >= 0 && report.data.stat.rate <= 100, '正确率应在 0~100');
ok(['扎实', '基本过关', '需要补', '要重讲'].includes(report.data.stat.level), '等级词应在四档内');
ok(report.data.units.length >= 1, '应有单元维度');
ok(report.data.units.every((u) => u.rate >= 0 && u.rate <= 100), '单元正确率应在 0~100');
ok(report.data.units.every((u, i, a) => i === 0 || a[i - 1].rate <= u.rate), '单元应按正确率升序（最差在前）');
console.log(`  正确率 ${report.data.stat.rate}%、等级「${report.data.stat.level}」、${report.data.units.length} 个单元`);

/* ================= 8. 教师端 ================= */
console.log('\n==== 教师端 ====');
const teacher = loadPage('pages/teacher/teacher.js');
teacher.onShow();
eq(teacher.data.books.length, 12, '内容覆盖册数');
ok(teacher.data.books.every((b) => b.nodeCount > 0 && b.questionCount > 0), '每册都应有内容');
eq(teacher.data.local.nodeAll, 493, '内容总量');
ok(teacher.data.local.qTotal > 0, '本机题量应 >0');
teacher.copyStats();
ok(storage.__clipboard && storage.__clipboard.includes('内容覆盖'), '复制文本应含内容覆盖');
console.log('  覆盖统计/本机概况/复制文本 正确');

/* ================= 9. 空态（新用户） ================= */
console.log('\n==== 空态 ====');
Object.keys(storage).forEach((k) => delete storage[k]);
const wrong2 = loadPage('pages/wrong/wrong.js');
wrong2.onShow();
eq(wrong2.data.count, 0, '无错题时计数为 0');
const report2 = loadPage('pages/report/report.js');
report2.onShow();
eq(report2.data.empty, true, '无记录时报告为空态');
const teacher2 = loadPage('pages/teacher/teacher.js');
teacher2.onShow();
eq(teacher2.data.local.qTotal, 0, '无记录时题量为 0');
eq(teacher2.data.local.rate, 0, '无记录时正确率为 0（不能是 NaN）');
console.log('  三页空态均正常，无 NaN / 报错');

/* ================= 输出 ================= */
console.log('\n==== 结果 ====');
if (fails.length) {
  console.log(`❌ ${fails.length} 处问题：`);
  fails.slice(0, 25).forEach((f) => console.log('   · ' + f));
  if (fails.length > 25) console.log(`   ... 其余 ${fails.length - 25} 条省略`);
  process.exit(1);
}
console.log('✅ 5 个页面全流程跑通，运行时断言全部通过');
