/**
 * 云端判分口径测试（打桩，不连真实云环境）
 *
 * 专抓一件事：解答题是学生自评，绝不能并进 practice_records 的 correct/total。
 * 前端已改口径，但云函数是独立部署的 —— 忘记重新部署时本机看似正常、
 * 班级报告却仍会虚高，所以两端必须各有断言。
 *
 * 运行：node tools/test_submit_answer.js
 */
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const LITE = require(path.join(ROOT, 'cloudfunctions/submitAnswer/content.lite.json'));

let problems = 0;
const eq = (a, b, msg) => {
  if (a !== b) { problems++; console.log(`  ❌ ${msg}（期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)}）`); }
};
const ok = (v, msg) => { if (!v) { problems++; console.log(`  ❌ ${msg}`); } };

/* ---------- 打桩 wx-server-sdk ---------- */
const inserted = { practice_records: [], wrong_questions: [] };
const mockDb = {
  command: { inc: (n) => ({ __inc: n }), exists: (v) => ({ __exists: v }) },
  serverDate: () => ({ __serverDate: true }),
  collection(name) {
    return {
      add: async ({ data }) => { (inserted[name] = inserted[name] || []).push(data); return { _id: 'mock' }; },
      where: () => ({ limit: () => ({ get: async () => ({ data: [] }) }) }),
      doc: () => ({ update: async () => ({}) }),
      aggregate: () => ({ group: () => ({ end: async () => ({ list: [] }) }) })
    };
  }
};
const mockCloud = {
  DYNAMIC_CURRENT_ENV: 'mock-env',
  init() {},
  getWXContext: () => ({ OPENID: 'mock-openid' }),
  database: () => mockDb
};

const origLoad = Module._load;
Module._load = function (req) {
  if (req === 'wx-server-sdk') return mockCloud;
  return origLoad.apply(this, arguments);
};
let submit;
try {
  submit = require(path.join(ROOT, 'cloudfunctions/submitAnswer/index.js')).main;
} finally {
  Module._load = origLoad;
}

/* ---------- 构造一份「机器题全错 + 解答题全自评会了」的提交 ---------- */
const NODE_ID = 'bsd-g3s-001';
const qs = Object.keys(LITE.questions)
  .filter((k) => LITE.questions[k].nodeId === NODE_ID)
  .map((k) => Object.assign({ id: k }, LITE.questions[k]))
  .sort((a, b) => a.no - b.no);

const autoQs = qs.filter((q) => q.type !== 'solve');
const solveQs = qs.filter((q) => q.type === 'solve');
ok(autoQs.length > 0 && solveQs.length > 0, '样本知识点应同时含机器判分题与解答题，反例才成立');

const answers = (selfMark) => qs.map((q) => {
  if (q.type === 'solve') return { questionId: q.id, type: 'solve', selected: '', selfMark };
  // 故意全填错：非空、但一定不等于标准答案
  const wrong = q.type === 'choice' ? 'Z' : q.type === 'judge' ? (q.answer === '对' ? '错' : '对') : '999999';
  return { questionId: q.id, type: q.type, selected: wrong, selfMark: '' };
});

(async () => {
  console.log('==== 云端判分口径 ====');

  const r = await submit({ nodeId: NODE_ID, book: 'g3s', answers: answers('ok') });
  eq(r.ok, true, '提交应成功');
  eq(r.total, autoQs.length, 'total 只含机器判分题');
  eq(r.correct, 0, '机器判分题全错 → correct 必须是 0');
  eq(r.selfTotal, solveQs.length, '自评题数单列');
  eq(r.selfCorrect, solveQs.length, '自评全勾「会了」→ selfCorrect 满，但不进 correct');

  const rec = inserted.practice_records[0];
  ok(rec, '应写入一条 practice_records');
  eq(rec.v, 2, '记录应带口径版本 v:2（genReport 只统计 v:2）');
  eq(rec.correct, 0, '落库 correct 不能被自评抬高');
  eq(rec.total, autoQs.length, '落库 total 只含机器判分题');
  ok(rec.answers.every((d) => typeof d.graded === 'boolean'), '逐题明细应标注是否机器判分');
  eq(rec.answers.filter((d) => !d.graded).length, solveQs.length, '解答题应全部标为自评');
  eq(inserted.wrong_questions.length, autoQs.length,
    '错题本只记机器判错的题（自评标「会了」的不算错）');

  // 自评标「不会」时，错题本要收，但正确率仍不能被影响
  inserted.practice_records.length = 0;
  inserted.wrong_questions.length = 0;
  const r2 = await submit({ nodeId: NODE_ID, book: 'g3s', answers: answers('no') });
  eq(r2.correct, 0, '自评标「不会」时 correct 仍是 0');
  eq(r2.selfCorrect, 0, '自评标「不会」时 selfCorrect 是 0');
  eq(inserted.wrong_questions.length, autoQs.length + solveQs.length,
    '自评标「不会」的解答题应进错题本');

  // 找不到标准答案（内容更新但云函数没重新部署）：退回自评，不能误判为对
  inserted.practice_records.length = 0;
  const r3 = await submit({
    nodeId: NODE_ID,
    answers: [{ questionId: 'not-in-lite', type: 'fill', selected: '', selfMark: 'ok' }]
  });
  eq(r3.total, 0, '无标准答案的题不能算进机器判分分母');
  eq(r3.selfTotal, 1, '无标准答案的题归入自评');
  eq(inserted.practice_records[0].correct, 0, '无标准答案时不能凭空算对');

  console.log(problems
    ? `\n❌ ${problems} 处问题`
    : `\n✅ 云端口径通过：自评 ${solveQs.length} 题全勾对，正确率仍为 0（旧口径会算成 ${Math.round(solveQs.length / qs.length * 100)}%）`);
  process.exit(problems ? 1 : 0);
})();
