// cloudfunctions/getClassStats/index.js —— 教师端：按知识点聚合全班错题
//
// 输出按「错误人次」降序，直接对应老师课上要讲哪几题：
//   [{ nodeId, nodeTitle, unit, wrongCount, students }]
// wrongCount 是累计错误次数（含同一学生反复错），students 是踩坑人数（去重），
// 两个都要看：人次高说明反复错，人数多说明普遍没听懂。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const $ = db.command.aggregate;

let LITE = { nodes: {} };
try {
  LITE = require('./content.lite.json');
} catch (e) {
  console.warn('[getClassStats] 缺 content.lite.json，nodeTitle 将回退为 id');
}

exports.main = async (event = {}) => {
  const book = event.book || null;
  const limit = Math.min(Number(event.limit || 30), 100);

  try {
    const where = { nodeId: db.command.exists(true) };
    if (book) where.book = book;

    const res = await db
      .collection('wrong_questions')
      .where(where)
      .aggregate()
      .group({
        _id: '$nodeId',
        wrongCount: $.sum('$wrongCount'),
        students: $.addToSet('$studentId')
      })
      .sort({ wrongCount: -1 })
      .limit(limit)
      .end();

    const stats = (res.list || []).map((r) => {
      const meta = LITE.nodes[r._id] || {};
      return {
        nodeId: r._id,
        nodeTitle: meta.title || r._id,
        unit: meta.unit || '',
        book: meta.book || '',
        wrongCount: r.wrongCount || 0,
        students: (r.students || []).length
      };
    });

    // 班级规模：本次有作答记录的学生人数
    let totalStudents = 0;
    try {
      const all = await db
        .collection('wrong_questions')
        .aggregate()
        .group({ _id: '$studentId' })
        .end();
      totalStudents = (all.list || []).length;
    } catch (e) {
      /* 忽略：规模是附加信息，查不到不影响主数据 */
    }

    return { ok: true, stats, totalStudents, book: book || 'all' };
  } catch (e) {
    // 集合未创建 / 无数据都不阻断界面
    return { ok: true, stats: [], totalStudents: 0, note: String(e).slice(0, 120) };
  }
};
