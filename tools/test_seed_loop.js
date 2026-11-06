#!/usr/bin/env node
/**
 * test_seed_loop.js —— 本地模拟跑 seedContent 云函数，验证「自动连写」模式
 *
 * 为什么需要：入库要写 2465 条文档，走的是云函数分片写入。
 * 本机没有云环境，改动分片逻辑后如果不模拟一遍，只能上云才知道对不对，
 * 而写错会导致「明明 finished 了却少了几百条」这种最难查的问题。
 *
 * 这里用 Module._load 打桩替换 wx-server-sdk，内存里模拟 db.add / count / remove，
 * 断言：
 *   1. 不带 auto：一次只写一批（老行为不能破）
 *   2. 带 auto：一次调用内连续写多批，受 budget 约束
 *   3. 反复调用直到 finished，最终条数与 content.json 完全一致（不多不少）
 *   4. 重复调用幂等：再跑一遍全都算 skipped，总条数不变
 *
 * 用法：node tools/test_seed_loop.js
 */
const path = require('path');
const Module = require('module');

const fails = [];
const eq = (a, b, msg) => { if (a !== b) fails.push(`${msg}（期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)}）`); };
const ok = (c, msg) => { if (!c) fails.push(msg); };

/* ---------- 打桩 wx-server-sdk ---------- */
const store = {};          // collName -> Map(_id -> doc)
const ensure = (n) => (store[n] = store[n] || new Map());

const fakeDb = {
  collection(name) {
    const m = ensure(name);
    return {
      add({ data }) {
        if (m.has(data._id)) return Promise.reject({ errMsg: 'duplicate key E11000 _id already exist' });
        m.set(data._id, data);
        return Promise.resolve({ _id: data._id });
      },
      count: () => Promise.resolve({ total: m.size }),
      where: () => ({ remove: () => { const n = m.size; m.clear(); return Promise.resolve({ stats: { removed: n } }); } })
    };
  },
  command: { exists: () => true }
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') {
    return { init() {}, DYNAMIC_CURRENT_ENV: 'test', database: () => fakeDb };
  }
  return origLoad.apply(this, arguments);
};

const FN = path.join(__dirname, '..', 'cloudfunctions', 'seedContent', 'index.js');
const seed = require(FN);
const content = require(path.join(__dirname, '..', 'cloudfunctions', 'seedContent', 'data', 'content.json'));

const N = content.nodes.length;
const Q = content.questions.length;
console.log(`==== seedContent 分片写入模拟（nodes ${N} / questions ${Q}）====`);

(async () => {
  /* 1. 不带 auto —— 只写一批 */
  let r = await seed.main({ action: 'seed', target: 'nodes', limit: 120 });
  eq(r.rounds, 1, '不带 auto 时应只写一批');
  eq(r.wrote, 120, '不带 auto 时写入条数 = limit');
  eq(r.finished, false, '不带 auto 且没写完时应 finished:false');
  eq(r.next, 120, '游标应停在 120');

  /* 2. 带 auto —— 一次调用内连续多批（budget 给足，让它跑到底） */
  r = await seed.main({ action: 'seed', target: 'nodes', limit: 120, auto: true, budget: 25000 });
  ok(r.rounds > 1, `带 auto 时应连续写多批（实际 ${r.rounds} 批）`);
  eq(r.next, N, 'nodes 应一次写完');
  eq(r.finished, true, 'nodes 写完 finished:true');
  eq(ensure('knowledge_nodes').size, N, `knowledge_nodes 条数应为 ${N}`);

  /* 3. budget 很小时应主动收手，返回未完成 + 可续写的 next */
  r = await seed.main({ action: 'seed', target: 'questions', limit: 120, auto: true, budget: 0 });
  eq(r.rounds, 1, 'budget=0 时应只写一批就收手');
  eq(r.finished, false, 'budget=0 时未写完应 finished:false');
  ok(typeof r.hint === 'string' && r.hint.includes('auto'), '未完成时应给出续写提示');

  /* 4. 反复调用直到写完，条数不多不少 */
  let guard = 0;
  while (!r.finished && guard++ < 100) {
    r = await seed.main({ action: 'seed', target: 'questions', offset: r.next, limit: 120, auto: true, budget: 25000 });
  }
  eq(r.finished, true, '反复调用后 questions 应写完');
  eq(ensure('questions').size, Q, `questions 条数应为 ${Q}`);

  /* 5. 幂等：整体再跑一遍，全部 skipped，条数不变 */
  r = await seed.main({ action: 'seed', target: 'nodes', limit: 200, auto: true, budget: 25000 });
  eq(r.wrote, 0, '重跑时不应写入重复文档');
  eq(r.skipped, N, '重跑时全部应记为 skipped');
  eq(ensure('knowledge_nodes').size, N, '重跑后条数不变');

  /* 6. count 自检 */
  const c = await seed.main({ action: 'count' });
  eq(c.nodes, N, 'count 返回 nodes 数');
  eq(c.questions, Q, 'count 返回 questions 数');
  eq(c.expect.nodes, N, 'count 返回期望 nodes 数');
  eq(c.expect.questions, Q, 'count 返回期望 questions 数');

  /* 7. clear */
  await seed.main({ action: 'clear', target: 'questions' });
  eq(ensure('questions').size, 0, 'clear 后 questions 应为空');

  Module._load = origLoad;

  console.log('\n==== 结果 ====');
  if (fails.length) {
    console.log(`❌ ${fails.length} 处问题：`);
    fails.forEach((f) => console.log('   · ' + f));
    process.exit(1);
  }
  console.log('✅ 分片写入/自动连写/断点续写/幂等/计数/清空 全部正确');
})();
