// cloudfunctions/submitAnswer/index.js —— 提交作答：服务端逐题判定 + 落库
//
// 为什么判定放服务端：前端传 correct 可以被改包伪造，老师看到的班级数据就不可信。
// 这里以 content.lite.json（构建时从 md 生成）里的标准答案为唯一依据，前端只传“选了什么”。
//
// 入参：{ nodeId, book, answers: [{ questionId, selected, selfMark }] }
// 出参：{ ok, correct, total, selfCorrect, selfTotal, details }
//
// 【口径】correct / total 只统计机器判分题（填空/选择/判断）。
// 解答题是学生自评，全勾「我会了」能刷出 100% 正确率，那个数字是假的，
// 因此单独存 selfCorrect / selfTotal，绝不并进 correct。班级报告也按这个口径。
// 找不到标准答案（内容更新但云函数没重新部署）的题同样归入自评，不误判为对。
//
// 写两张表：
//   practice_records  一次提交一条（含逐题明细 + v:2 口径版本）
//   wrong_questions   逐题 upsert（机器判错 + 自评标「不会」都记）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

let LITE = { nodes: {}, questions: {} };
try {
  LITE = require('./content.lite.json');
} catch (e) {
  console.warn('[submitAnswer] 缺 content.lite.json，将只信任前端判定');
}

// 与小程序端 learn.js 的 norm() 必须完全一致，否则会出现“前端说对、后端说错”
function norm(s) {
  return String(s == null ? '' : s)
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[＝=]/g, '=')
    .replace(/[，,。．.；;：:！!？?、\s]/g, '')
    .trim();
}

function judge(type, answer, selected) {
  const sel = String(selected == null ? '' : selected).trim();
  if (!sel) return false;
  if (type === 'choice') return sel.toUpperCase() === String(answer).trim().toUpperCase();
  if (type === 'judge') return sel === String(answer).trim();
  return norm(sel) === norm(answer);
}

async function upsertWrong(studentId, questionId, nodeId, meta) {
  const coll = db.collection('wrong_questions');
  try {
    const found = await coll.where({ studentId, questionId }).limit(1).get();
    if (found.data && found.data.length) {
      await coll.doc(found.data[0]._id).update({
        data: { wrongCount: _.inc(1), lastWrongAt: db.serverDate() }
      });
    } else {
      await coll.add({
        data: {
          studentId,
          questionId,
          nodeId,
          nodeTitle: meta.title || '',
          unit: meta.unit || '',
          book: meta.book || '',
          wrongCount: 1,
          status: 'open',
          lastWrongAt: db.serverDate()
        }
      });
    }
  } catch (e) {
    console.warn('[submitAnswer] wrong_questions 写入失败（集合可能未创建）', String(e).slice(0, 100));
  }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  const { nodeId, book, answers = [] } = event;
  if (!nodeId || !Array.isArray(answers) || !answers.length) {
    return { ok: false, msg: '参数缺失：需要 nodeId 与 answers' };
  }

  const nodeMeta = LITE.nodes[nodeId] || {};
  const details = answers.map((a) => {
    const std = LITE.questions[a.questionId];
    const type = std ? std.type : a.type || 'fill';
    const answer = std ? std.answer : a.answer;
    // 只有「有标准答案 且 不是解答题」才算机器判分；其余一律走自评
    const graded = !!std && type !== 'solve';
    const isCorrect = graded
      ? judge(type, answer, a.selected)
      : a.selfMark === 'ok';
    return {
      questionId: a.questionId,
      no: std ? std.no : null,
      type,
      selected: a.selected,
      answer: answer || null,
      graded,
      isCorrect
    };
  });

  const graded = details.filter((d) => d.graded);
  const self = details.filter((d) => !d.graded);
  const correct = graded.filter((d) => d.isCorrect).length;
  const total = graded.length;
  const selfCorrect = self.filter((d) => d.isCorrect).length;
  const selfTotal = self.length;

  // 1) 练习记录
  try {
    await db.collection('practice_records').add({
      data: {
        studentId: OPENID,
        nodeId,
        book: book || nodeMeta.book || '',
        unit: nodeMeta.unit || '',
        nodeTitle: nodeMeta.title || '',
        answers: details,
        correct,          // 只算机器判分题
        total,            // 只算机器判分题（可能为 0：整节都是解答题）
        selfCorrect,      // 学生自评，单独存
        selfTotal,
        v: 2,             // 口径版本，报告端只统计 v:2
        submitAt: db.serverDate()
      }
    });
  } catch (e) {
    console.warn('[submitAnswer] practice_records 写入失败（集合可能未创建）', String(e).slice(0, 100));
  }

  // 2) 错题 upsert（并发）
  const wrongs = details.filter((d) => !d.isCorrect);
  await Promise.all(
    wrongs.map((d) => upsertWrong(OPENID, d.questionId, nodeId, {
      title: nodeMeta.title,
      unit: nodeMeta.unit,
      book: book || nodeMeta.book
    }))
  );

  return { ok: true, correct, total, selfCorrect, selfTotal, details, wrongAdded: wrongs.length };
};
