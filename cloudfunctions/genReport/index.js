// cloudfunctions/genReport/index.js —— 生成学习/班级报告（规则版，不依赖大模型）
//
// 设计取舍：先用规则版跑通闭环。规则版可解释、可复现、零成本，老师能追问“这个结论哪来的”。
// 等真实数据跑一学期、字段与口径稳定后，再把 LLM 叠在规则结论之上
// （LLM 只做归因与措辞，不负责算数——数字必须来自数据库）。
//
// 入参：{ scope: 'student' | 'class' }
// 出参：{ ok, report: { scope, summary, advice, weak[], generatedAt } }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const $ = db.command.aggregate;

let LITE = { nodes: {} };
try {
  LITE = require('./content.lite.json');
} catch (e) {
  console.warn('[genReport] 缺 content.lite.json，知识点标题回退为 id');
}

const title = (nodeId) => (LITE.nodes[nodeId] && LITE.nodes[nodeId].title) || nodeId;

async function sumPractice(where) {
  const out = { qTotal: 0, qCorrect: 0, times: 0 };
  try {
    // 只统计 v:2：这一版起 practice_records 的 correct/total 只含机器判分题。
    // 旧记录把解答题自评也算了进去，混进来会让「全班正确率」虚高，宁可不显示。
    const cond = Object.assign({ v: 2 }, where || {});
    const q = db.collection('practice_records').where(cond);
    const agg = await q
      .aggregate()
      .group({ _id: null, qTotal: $.sum('$total'), qCorrect: $.sum('$correct'), times: $.sum(1) })
      .end();
    const r = (agg.list || [])[0] || {};
    out.qTotal = r.qTotal || 0;
    out.qCorrect = r.qCorrect || 0;
    out.times = r.times || 0;
  } catch (e) {
    /* 集合未创建：返回全 0，报告会提示“暂无数据” */
  }
  return out;
}

async function studentReport(openid) {
  const { qTotal, qCorrect, times } = await sumPractice({ studentId: openid });
  const rate = qTotal ? Math.round((qCorrect / qTotal) * 100) : 0;

  let weak = [];
  try {
    const agg = await db
      .collection('wrong_questions')
      .where({ studentId: openid })
      .aggregate()
      .group({ _id: '$nodeId', wrongCount: $.sum('$wrongCount') })
      .sort({ wrongCount: -1 })
      .limit(5)
      .end();
    weak = (agg.list || []).map((r) => ({
      nodeId: r._id,
      nodeTitle: title(r._id),
      wrongCount: r.wrongCount
    }));
  } catch (e) {
    /* 集合未创建 */
  }

  const level =
    rate >= 90 ? '掌握扎实。' : rate >= 75 ? '基本过关，个别题型还不稳。' : rate >= 60 ? '有一批题需要补。' : '基础环节需要重讲。';
  const summary = times
    ? `共完成 ${times} 次练习；机器判分 ${qTotal} 道、答对 ${qCorrect} 道，正确率 ${rate}%（解答题自评不计入）。${level}`
    : '还没有提交过练习。';

  let advice = '';
  if (weak.length) {
    const names = weak.slice(0, 3).map((w) => `《${w.nodeTitle}》`).join('、');
    advice =
      `先补 ${names}。` +
      `最要紧的是《${weak[0].nodeTitle}》，累计错 ${weak[0].wrongCount} 次。` +
      '做法：看讲解里的易错点 → 重做这个知识点 → 再刷一遍错题本，比盲目刷题有效。';
  } else if (times) {
    advice = '没有错题记录，说明当前难度偏低，可以直接挑战下一单元。';
  }

  return { scope: 'student', summary, advice, weak, generatedAt: Date.now() };
}

async function classReport() {
  const { qTotal, qCorrect, times } = await sumPractice(null);
  const rate = qTotal ? Math.round((qCorrect / qTotal) * 100) : 0;

  let weak = [];
  try {
    const agg = await db
      .collection('wrong_questions')
      .aggregate()
      .group({
        _id: '$nodeId',
        wrongCount: $.sum('$wrongCount'),
        students: $.addToSet('$studentId')
      })
      .sort({ wrongCount: -1 })
      .limit(5)
      .end();
    weak = (agg.list || []).map((r) => ({
      nodeId: r._id,
      nodeTitle: title(r._id),
      wrongCount: r.wrongCount,
      students: (r.students || []).length
    }));
  } catch (e) {
    /* 集合未创建 */
  }

  const summary = times
    ? `全班累计 ${times} 次作答；机器判分 ${qTotal} 道，整体正确率 ${rate}%（解答题自评不计入）。`
    : '暂无班级作答数据。学生提交练习后这里会自动汇总。';

  let advice = '';
  if (weak.length) {
    const top = weak[0];
    advice =
      `建议下节课先讲《${top.nodeTitle}》：${top.students} 人踩坑、累计错 ${top.wrongCount} 次。` +
      (weak.length > 1 ? `《${weak[1].nodeTitle}》也值得用 5 分钟复述一遍。` : '') +
      '讲完当场让全班重做同一知识点，对比正确率变化。';
  } else if (times) {
    advice = '没有错题记录，可推进下一单元。';
  }

  return { scope: 'class', summary, advice, weak, generatedAt: Date.now() };
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  const scope = event.scope === 'class' ? 'class' : 'student';

  const report = scope === 'class' ? await classReport() : await studentReport(OPENID);

  // 落库留档，便于期末回溯
  try {
    await db.collection('ai_reports').add({
      data: {
        scope,
        targetId: scope === 'class' ? 'class' : OPENID,
        period: new Date().toISOString().slice(0, 7), // YYYY-MM
        content: report,
        generatedAt: db.serverDate()
      }
    });
  } catch (e) {
    console.warn('[genReport] ai_reports 写入失败（集合可能未创建）', String(e).slice(0, 100));
  }

  return { ok: true, report };
};
