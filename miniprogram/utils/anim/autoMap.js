// utils/anim/autoMap.js —— 把「一节知识点」自动映射到「场景 + 真实题目数据」
//
// 这是 486 知识点能批量铺开的关键：不再手画 486 个片子，而是
//   1) 读这一节第一题的题干，认出是哪种运算（加/减/乘/除/面积/周长/分数/小数/比较）
//   2) 抽出真实数字，组装成场景要的 data
//   3) **安全闸**：用这些数字算出的结果，必须和该题正确答案一致，才放行。
//      不一致说明抽错了（歧义题干），宁可不显示动画，也不能让老师放出 5+3=7 误人子弟。
//
// 返回 { scene, data } 或 null（null = 这一节暂时没有能安全演示的场景，流程照常不崩）。

const ex = require('./extract.js');

/* 把选择题的答案字母解析成选项文本；其余题型直接用 answer */
function resolveAnswer(q) {
  if (q.type === 'choice') {
    const opt = (q.options || []).find(
      (o) => o.charAt(0).toUpperCase() === String(q.answer || '').trim().toUpperCase()
    );
    return opt || q.answer;
  }
  return q.answer;
}

/* 从答案文本里取「结果数字」：优先等号右边的最后一个数（"4＋3＝7（只）"→7） */
function answerResult(ansText) {
  const s = String(ansText == null ? '' : ansText);
  const eq = s.indexOf('＝');
  const base = eq >= 0 ? s.slice(eq + 1) : s;
  const nums = ex.parseNums(base);
  return nums.length ? nums[nums.length - 1] : null;
}

/* 答案里出现的分数（"六分之五" / "5/6"） */
function answerFractions(ansText) {
  return ex.parseFractions(String(ansText == null ? '' : ansText));
}

/* 从题干里摘一个量词当单位（没有就默认「个」） */
function inferUnit(stem) {
  const units = ['厘米', '分米', '毫米', '米', '千米', '千克', '克', '公斤', '元', '角', '分',
    '朵', '只', '根', '支', '本', '块', '颗', '条', '张', '片', '棵', '匹', '辆', '间', '页', '个'];
  for (const u of units) if (stem.indexOf(u) >= 0) return u;
  return '个';
}

/* 分数约分 */
function reduce(a, b) {
  const g = (x, y) => { while (y) { [x, y] = [y, x % y]; } return x; };
  const d = g(a, b);
  return [a / d, b / d];
}

/*
 * 每个 matcher：match(q) → {scene, data} | null
 * 内部自己做「测试是否命中」+「安全闸比对答案」，两条都过才返回。
 * 顺序很重要：特异性高的（带「剩/余」的除法）放前面，避免被泛化的乘法/减法抢走。
 */
const MATCHERS = [

  /* ---- 平均分：把 A 平均分给 B，每人几 ---- */
  {
    scene: 'divideEqual',
    match(q) {
      const s = q.stem;
      if (!ex.has(s, '平均分', '分给', '每人', '每份', '均分')) return null;
      const nums = ex.parseNums(s);
      if (nums.length < 2) return null;
      const total = nums[0], groups = nums[1];
      if (groups <= 0 || total % groups !== 0) return null;
      const each = total / groups;
      if (answerResult(resolveAnswer(q)) !== each) return null;
      return { scene: this.scene, data: { total, groups, each, unit: inferUnit(s) } };
    }
  },

  /* ---- 面积：长 A 宽 B ---- */
  {
    scene: 'rectangleArea',
    match(q) {
      const s = q.stem;
      if (!ex.has(s, '面积')) return null;
      if (!ex.has(s, '长', '宽', '正方形', '长方形')) return null;
      const nums = ex.parseNums(s);
      if (nums.length < 2) return null;
      const w = nums[0], h = nums[1];
      const area = w * h;
      if (answerResult(resolveAnswer(q)) !== area) return null;
      return { scene: this.scene, data: { w, h, area, unit: inferUnit(s) } };
    }
  },

  /* ---- 周长：长 A 宽 B 绕一圈 ---- */
  {
    scene: 'perimeter',
    match(q) {
      const s = q.stem;
      if (!ex.has(s, '周长')) return null;
      if (!ex.has(s, '长', '宽', '正方形', '长方形')) return null;
      const nums = ex.parseNums(s);
      if (nums.length < 2) return null;
      const w = nums[0], h = nums[1];
      const peri = 2 * (w + h);
      if (answerResult(resolveAnswer(q)) !== peri) return null;
      return { scene: this.scene, data: { w, h, unit: inferUnit(s) } };
    }
  },


  /* ---- 分数加法：a/b + c/d ---- */
  {
    scene: 'fractionAdd',
    match(q) {
      const s = q.stem;
      const fr = ex.parseFractions(s + ' ' + String(q.answer == null ? '' : q.answer));
      if (fr.length < 2) return null;
      if (!ex.has(s, '加', '+', '和', '一共', '计算', '求和')) return null;
      const { a, b } = fr[0], { c, d } = fr[1];
      const [na, nb] = reduce(a * d + b * c, b * d);
      const anF = answerFractions(resolveAnswer(q));
      const ok = anF.some((f) => f.a === na && f.b === nb);
      if (!ok) return null;
      return { scene: this.scene, data: { a, b, c, d } };
    }
  },

  /* ---- 连加：三个及以上数连续加 ---- */
  {
    scene: 'chainAdd',
    match(q) {
      const s = q.stem;
      if (!ex.has(s, '连加', '连续加', '一共', '和')) return null;
      const nums = ex.parseNums(s);
      if (nums.length < 3) return null;
      const sum = nums.reduce((x, y) => x + y, 0);
      if (answerResult(resolveAnswer(q)) !== sum) return null;
      const [a, b, c] = nums;
      return { scene: this.scene, data: { a, b, c, ab: a + b, sum, unit: inferUnit(s) } };
    }
  },

  /* ---- 连减 / 加减混合：先…再… 或 连减 ---- */
  {
    scene: 'chainSub',
    match(q) {
      const s = q.stem;
      if (!ex.has(s, '连减', '连续减', '先', '再')) return null;
      const nums = ex.parseNums(s);
      if (nums.length < 3) return null;
      const [a, b, c] = nums;
      const cands = [
        { op1: 'sub', op2: 'sub', x: a - b, result: (a - b) - c },
        { op1: 'add', op2: 'sub', x: a + b, result: (a + b) - c },
        { op1: 'sub', op2: 'add', x: a - b, result: (a - b) + c }
      ];
      const ans = answerResult(resolveAnswer(q));
      for (const cd of cands) {
        if (ans === cd.result) return { scene: this.scene, data: { a, b, c, op1: cd.op1, op2: cd.op2, x: cd.x, result: cd.result, unit: inferUnit(s) } };
      }
      return null;
    }
  },

  /* ---- 两位数竖式加减（进位/退位） ---- */
  {
    scene: 'columnOp',
    match(q) {
      const s = q.stem;
      if (!ex.has(s, '竖式', '列竖式', '进位', '退位', '位值')) return null;
      const nums = ex.parseNums(s).filter((n) => n >= 10);
      if (nums.length < 2) return null;
      const a = nums[0], b = nums[1];
      const isSub = ex.has(s, '减', '－', '-');
      const op = isSub ? 'sub' : 'add';
      const result = op === 'sub' ? a - b : a + b;
      if (answerResult(resolveAnswer(q)) !== result) return null;
      return { scene: this.scene, data: { a, b, op, result, unit: inferUnit(s) } };
    }
  },


  /* ---- 认识分数（几分之一/几分之几）：分数写在答案里 ---- */
  {
    scene: 'fractionIntro',
    match(q) {
      const s = q.stem;
      if (!ex.has(s, '平均分', '分成', '取', '分数', '几分之一', '几分之几', '一份', '其中', '表示')) return null;
      const af = ex.parseFractions(String(q.answer == null ? '' : q.answer));
      if (af.length !== 1) return null;
      const { a, b } = af[0];
      if (b <= 0 || b > 24 || a > b) return null;
      return { scene: this.scene, data: { a, b } };
    }
  },

  /* ---- 小数加减（按 ＋/－/加/减 符号判定运算） ---- */
  {
    scene: 'decimalAdd',
    match(q) {
      const s = q.stem;
      const isDecimal = /\d\.\d/.test(s) || ex.has(s, '小数');
      if (!isDecimal) return null;
      const isSub = ex.has(s, '减', '－', '-', '差');
      const isAdd = ex.has(s, '加', '＋', '+', '和', '一共');
      if (!isSub && !isAdd) return null;
      const all = ex.parseNums(s);
      if (all.length < 2) return null;
      const a = all[0], b = all[1];
      const op = isSub ? a - b : a + b;
      const ans = answerResult(resolveAnswer(q));
      if (ans == null || Math.abs(ans - Math.round(op * 100) / 100) > 0.011) return null;
      return { scene: this.scene, data: { a, b, op: isSub ? 'sub' : 'add', result: Math.round(op * 100) / 100, unit: inferUnit(s) } };
    }
  },

  /* ---- 减法（拿走/吃掉/飞走：初始 A，拿走 B，剩 A-B） ---- */
  {
    scene: 'subtractTake',
    match(q) {
      const s = q.stem;
      if (!ex.has(s, '吃', '喝', '拿', '去', '减', '借', '飞', '游', '卖', '丢', '用', '走', '掉')) return null;
      const nums = ex.parseNums(s);
      if (nums.length < 2) return null;
      const a = nums[0], b = nums[1];
      if (a - b < 0) return null;
      if (answerResult(resolveAnswer(q)) !== a - b) return null;
      return { scene: this.scene, data: { a, b, diff: a - b, unit: inferUnit(s) } };
    }
  },

  /* ---- 减法（比较：甲 A 乙 B，相差 |A-B|） ---- */
  {
    scene: 'subtractCompare',
    match(q) {
      const s = q.stem;
      if (!ex.has(s, '比')) return null;
      if (!ex.has(s, '多', '少', '相差', '几')) return null;
      const nums = ex.parseNums(s);
      if (nums.length < 2) return null;
      const a = nums[0], b = nums[1];
      if (answerResult(resolveAnswer(q)) !== Math.abs(a - b)) return null;
      return { scene: this.scene, data: { a, b, diff: Math.abs(a - b), unit: inferUnit(s) } };
    }
  },

  /* ---- 乘法（几个几）：每 X 有 Y / A 的 B 倍 / 「3 个 4」 ---- */
  {
    scene: 'multiplyGroups',
    match(q) {
      const s = q.stem;
      // 强信号才认乘法，避免把「两步加法」「一共」误判成乘法
      const hasMulSignal = ex.has(s, '每', '倍', '份数') ||
        /\d+\s*个\s*\d+/.test(s) || /\d+\s*组\s*\d+/.test(s);
      if (!hasMulSignal) return null;
      const nums = ex.parseNums(s);
      if (nums.length < 2) return null;
      let each, groups;
      const mi = s.indexOf('每');
      if (mi >= 0) {
        // 「每 X 有 Y」：每后面的数是每份，另一个是份数
        const after = ex.parseNums(s.slice(mi));
        if (after.length >= 2) { each = after[0]; groups = after[1]; }
        else { each = nums[0]; groups = nums[1]; }
      } else if (ex.has(s, '倍')) {
        each = nums[0]; groups = nums[1]; // A 的 B 倍
      } else {
        each = nums[0]; groups = nums[1];
      }
      if (each <= 0 || groups <= 0) return null;
      const product = each * groups;
      if (answerResult(resolveAnswer(q)) !== product) return null;
      return { scene: this.scene, data: { each, groups, product, unit: inferUnit(s) } };
    }
  },

  /* ---- 加法（合起来：A + B） ---- */
  {
    scene: 'addMeaning',
    match(q) {
      const s = q.stem;
      if (!ex.has(s, '一共', '合', '加上', '又', '再加', '和', '总共', '共')) return null;
      const nums = ex.parseNums(s);
      if (nums.length < 2) return null;
      const a = nums[0], b = nums[1];
      if (answerResult(resolveAnswer(q)) !== a + b) return null;
      return { scene: this.scene, data: { a, b, sum: a + b, unit: inferUnit(s) } };
    }
  },

  /* ---- 比较大小：谁大/谁小/按…排列/谁多谁少（拒绝分类题与「比…多几」减法题） ---- */
  {
    scene: 'compareNumbers',
    match(q) {
      const s = q.stem;
      if (q.type === 'judge') return null;
      if (ex.has(s, '种类', '分类', '类别', '辨认', '立体', '平面图形', '图形', '对称轴', '轴对称')) return null;
      // 「A 比 B 多/少 几」是减法（求差），交给 subtractCompare，这里不抢
      if (ex.has(s, '比') && ex.has(s, '几', '相差')) return null;
      const isCompare = ex.has(s, '比一比', '谁大', '谁小', '最大', '最小', '大于', '小于', '多', '少', '比较') ||
        (ex.has(s, '按') && ex.has(s, '排', '顺序', '从小到大', '从大到小')) ||
        (ex.has(s, '从') && ex.has(s, '排列')) ||
        (/\d\.\d/.test(s) && ex.has(s, '大', '小', '比较', '比'));
      if (!isCompare) return null;
      const nums = ex.parseNums(s);
      if (nums.length < 2) return null;
      // 轻闸：若答案是数字，必须出现在题干数字里
      const ans = answerResult(resolveAnswer(q));
      if (ans != null && !nums.includes(ans)) return null;
      return { scene: this.scene, data: { nums: nums.slice(0, 4), unit: inferUnit(s) } };
    }
  }
];

function answerNumbers(t) { return ex.parseNums(String(t == null ? '' : t)); }

/**
 * 自动映射一节知识点。优先用第一题，若第一题过不了闸（比如是判断/选择干扰），
 * 再试前两题里能稳定命中的，提高覆盖。
 * @param {object} node  content.js 里的节点
 * @returns {{scene:string,data:object}|null}
 */
function autoMap(node) {
  if (!node || !node.questions || !node.questions.length) return null;
  const qs = node.questions.slice(0, 3);
  for (const q of qs) {
    for (const m of MATCHERS) {
      const r = m.match(q);
      if (r) return r;
    }
  }
  return null;
}

module.exports = { autoMap, MATCHERS };
