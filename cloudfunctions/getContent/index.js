// cloudfunctions/getContent/index.js —— 内容读取通道（不重新发版即可更新题目）
//
// 小程序默认从包内 data/content.js 读内容（启动更快、离线可用）。
// 这个函数是逃生通道：学期中期改了几道题，不想走审核发版时，
// 在数据库改完、再把小程序改成读云端即可。
//
// 入参：
//   { book: 'g3s' }                 → 该册全部节点 + 题目
//   { nodeId: 'bsd-g3s-001' }       → 单个节点 + 题目
//   {}                              → 内容清单（各册规模），不返回正文
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const content = require('./content.json');

exports.main = async (event = {}) => {
  const { book, nodeId } = event;

  // 单节点
  if (nodeId) {
    const node = content.nodes.find((n) => n._id === nodeId);
    if (!node) return { ok: false, msg: `没有这个知识点：${nodeId}` };
    const questions = content.questions
      .filter((q) => q.nodeId === nodeId)
      .sort((a, b) => a.no - b.no)
      .map((q) => ({
        id: q._id,
        no: q.no,
        level: q.level,
        type: q.type,
        stem: q.stem,
        options: q.options,
        answer: q.answer,
        analysis: q.analysis
      }));
    return {
      ok: true,
      node: {
        id: node._id,
        book: node.book,
        grade: node.grade,
        unit: node.unit,
        title: node.title,
        order: node.order,
        story: node.story,
        storyHtml: node.storyHtml,
        wrongTip: node.wrongTip,
        questions
      }
    };
  }

  // 整册
  if (book) {
    const nodes = content.nodes.filter((n) => n.book === book);
    if (!nodes.length) return { ok: false, msg: `没有这一册：${book}` };
    const out = nodes.map((n) => ({
      id: n._id,
      book: n.book,
      grade: n.grade,
      unit: n.unit,
      unitSeq: n.unitSeq,
      title: n.title,
      order: n.order,
      story: n.story,
      storyHtml: n.storyHtml,
      wrongTip: n.wrongTip,
      questions: content.questions
        .filter((q) => q.nodeId === n._id)
        .sort((a, b) => a.no - b.no)
        .map((q) => ({
          id: q._id,
          no: q.no,
          level: q.level,
          type: q.type,
          stem: q.stem,
          options: q.options,
          answer: q.answer,
          analysis: q.analysis
        }))
    }));
    return { ok: true, book, nodes: out, count: out.length };
  }

  // 清单
  return { ok: true, books: content.books };
};
