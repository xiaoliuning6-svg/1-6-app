// cloudfunctions/seedContent/index.js —— 把打包进云函数的全部内容写进数据库
//
// 为什么不用控制台手动导入：十二册共 2465 条文档，要分 2 个集合写，手动点二十几次，
// 容易漏、容易重。这个函数支持分片调用（云函数有超时限制，一次写不完全部），
// 每次写入 limit 条，返回 next 游标；重复调用安全（已存在的 _id 自动跳过，幂等）。
//
// 调用参数：
//   { action: 'seed', target: 'nodes' | 'questions', offset: 0, limit: 120, auto: true, budget: 15000 }
//   { action: 'count' }
//   { action: 'clear', target: 'nodes' | 'questions' }
//
// auto: true 会在本次调用内连续写多批，直到 budget 毫秒快到上限才返回（把「点二十几次」
// 压到「点两三次」）。前提：云开发控制台把本函数超时时间调到 20 秒（默认 3 秒太小）。
// 不带 auto 则只写一批 —— 老行为不变。
//
// 典型用法（云开发控制台 → 云函数 → seedContent → 测试）：
//   1. {"action":"seed","target":"nodes","auto":true}      → 反复点，直到 finished: true
//   2. {"action":"seed","target":"questions","auto":true}   → 反复点，直到 finished: true
//   3. {"action":"count"}                                   → 核对条数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const content = require('./data/content.json');

const COLL = { nodes: 'knowledge_nodes', questions: 'questions' };

async function writeBatch(collName, docs) {
  const coll = db.collection(collName);
  const results = await Promise.allSettled(docs.map((d) => coll.add({ data: d })));
  let inserted = 0;
  let dup = 0;
  const errs = [];
  results.forEach((r) => {
    if (r.status === 'fulfilled') {
      inserted++;
    } else {
      const msg = String((r.reason && r.reason.errMsg) || r.reason);
      // _id 冲突 = 上次已经写进去了，算正常
      if (/duplicate|already exist|-502001|E11000/i.test(msg)) dup++;
      else if (errs.length < 3) errs.push(msg.slice(0, 120));
    }
  });
  return { inserted, dup, errs };
}

exports.main = async (event = {}) => {
  const action = event.action || 'seed';
  const target = event.target || 'nodes';
  const offset = Number(event.offset || 0);
  const limit = Math.min(Number(event.limit || 120), 200);
  const collName = COLL[target];

  if (!collName) return { ok: false, msg: 'target 只能是 nodes 或 questions' };

  /* ---- 计数 ---- */
  if (action === 'count') {
    const out = {};
    for (const [k, name] of Object.entries(COLL)) {
      try {
        const r = await db.collection(name).count();
        out[k] = r.total;
      } catch (e) {
        out[k] = `读取失败（集合可能未创建）：${String(e).slice(0, 60)}`;
      }
    }
    out.expect = { nodes: content.nodes.length, questions: content.questions.length };
    return { ok: true, ...out };
  }

  /* ---- 清空 ---- */
  if (action === 'clear') {
    try {
      // 服务端可批量删；循环直到删空（单次上限 1000）
      let removed = 0;
      for (let i = 0; i < 10; i++) {
        const r = await db.collection(collName).where({ _id: _.exists(true) }).remove();
        removed += (r.stats && r.stats.removed) || 0;
        if (!r.stats || !r.stats.removed) break;
      }
      return { ok: true, target, removed };
    } catch (e) {
      return { ok: false, msg: String(e) };
    }
  }

  /* ---- 写入 ---- */
  const all = target === 'nodes' ? content.nodes : content.questions;
  const auto = event.auto === true || event.auto === 'true';
  const budget = Math.min(event.budget == null ? 15000 : Number(event.budget), 25000);
  const deadline = Date.now() + (auto ? budget : 0);

  let cursor = offset;
  let inserted = 0;
  let skipped = 0;
  let rounds = 0;
  const errs = [];

  while (cursor < all.length) {
    // 至少写一批；之后每批之前看表，快到超时上限就收手（把控制权还给调用方重试）
    if (auto && rounds > 0 && Date.now() >= deadline) break;
    const slice = all.slice(cursor, cursor + limit);
    if (!slice.length) break;
    const r = await writeBatch(collName, slice);
    inserted += r.inserted;
    skipped += r.dup;
    r.errs.forEach((e) => { if (errs.length < 3) errs.push(e); });
    cursor += slice.length;
    rounds++;
    if (!auto) break;                    // 不带 auto：只写一批（老行为）
  }

  const finished = cursor >= all.length;
  return {
    ok: true,
    target,
    wrote: inserted,
    skipped,
    errors: errs,
    rounds,
    range: `${offset}~${cursor - 1}`,
    total: all.length,
    next: cursor,
    finished,
    hint: finished
      ? `本集合已完成（共 ${all.length} 条）`
      : `还有 ${all.length - cursor} 条，再点一次同样的 {"action":"seed","target":"${target}","auto":true} 即可（会自动从第 ${cursor} 条续写）`
  };
};
