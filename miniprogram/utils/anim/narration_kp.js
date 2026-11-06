// utils/anim/narration_kp.js —— 逐知识点旁白「字幕」自动生成（零音频成本）
//
// 为什么有这个文件：
//   narration.js 里那 4 套旁白是预打包 mp3（教室无网不能运行时 TTS，必须预存）。
//   但 486 个知识点若每个都预存 3~5 句 mp3，约 50~60MB，直接爆掉 20MB 分包上限。
//   所以「讲解」分两层交付：
//     1) 字幕（本文件生成，纯文本，零体积）—— 现在全量覆盖。
//     2) 语音 mp3 —— 仅限 7 个旗舰节点预打包；其余按年级/热度后续分批补，不阻塞使用。
//
// 本文件按「场景名 + 真实 data」生成字幕行，每行带 t/dur（驱动画面 cue 节奏）。
// 数字一律走 num2cn，避免 edge-tts 把「1/2」「3+2」读错。
//
// ⚠️ 行数必须与对应场景 draw 里用的 cue 数量一致（大多 5 句，conceptCard 4 句），
//    否则画面 cue 越界取到 total、字幕也对不上。

const { num2cn, frac } = require('./num2cn.js');
const { speakable, pickSentences } = require('./text.js');

const N = num2cn;

/* 根据字幕文本估算这一句该占多久（秒）：中文朗读约每字 0.26s + 起停冗余 */
function durOf(text) {
  const chars = text.replace(/[\s，。、！？]/g, '').length;
  return Math.max(1.5, Math.round((chars * 0.26 + 0.6) * 10) / 10);
}

/* 把若干句文案排成时间轴（句间留 0.14s 间隙，和 legacy 一致） */
function timeline(texts) {
  const lines = [];
  let t = 0;
  texts.forEach((tx) => {
    const dur = durOf(tx);
    lines.push({ t: Math.round(t * 100) / 100, dur, text: tx });
    t += dur + 0.14;
  });
  const total = lines.length ? lines[lines.length - 1].t + lines[lines.length - 1].dur : 0;
  return { total: Math.round(total * 100) / 100, lines };
}

/* ---------------- 各场景字幕模板 ---------------- */

function linesFor(scene, data, node) {
  data = data || {};
  switch (scene) {
    /* —— 加法意义：两组合起来 —— */
    case 'addMeaning': {
      const a = data.a != null ? data.a : 3;
      const b = data.b != null ? data.b : 2;
      const sum = data.sum != null ? data.sum : a + b;
      const u = data.unit || '个';
      return [
        `左边有${N(a)}个，右边有${N(b)}个。`,
        `把两堆放到一起，就是合起来。`,
        `合起来，用加法来算。`,
        `${N(a)}加${N(b)}，等于${N(sum)}。`,
        `一共有${N(sum)}${u}。`
      ];
    }
    /* —— 凑十法 —— */
    case 'makeTen': {
      const a = data.a != null ? data.a : 9;
      const b = data.b != null ? data.b : 5;
      const tenPart = 10 - a;
      const rest = b - tenPart;
      const result = a + b;
      return [
        `先看这个十格阵，里面已经放了${N(a)}个圆点。`,
        `还空着一格，差一个就满十了。`,
        `从右边的${N(b)}个里，拿一个放进去。`,
        `十格满了，这十个就是一个十。`,
        `右边还剩${N(rest)}个，十加${N(rest)}等于${N(result)}。`
      ];
    }
    /* —— 周长：沿边绕一圈 —— */
    case 'perimeter': {
      const w = data.w != null ? data.w : 5;
      const h = data.h != null ? data.h : 3;
      const u = data.unit || '厘米';
      const total = 2 * (w + h);
      return [
        `这是一个长方形，长${N(w)}${u}，宽${N(h)}${u}。`,
        `小球从角上出发，沿着边一直走。`,
        `每走过一条边，就记下它的长度。`,
        `四条边全走完，一共走了多少，就是周长。`,
        `${N(w)}加${N(h)}，加${N(w)}，加${N(h)}，等于${N(total)}${u}。`
      ];
    }
    /* —— 异分母分数加法 —— */
    case 'fractionAdd': {
      const a = data.a != null ? data.a : 1;
      const b = data.b != null ? data.b : 2;
      const c = data.c != null ? data.c : 1;
      const d = data.d != null ? data.d : 3;
      const g = (x, y) => { while (y) { [x, y] = [y, x % y]; } return x; };
      const common = (b * d) / g(b, d);
      const fa = a * (common / b);
      const fc = c * (common / d);
      const result = fa + fc;
      return [
        `要算${frac(a, b)}加${frac(c, d)}。`,
        `分母不一样，不能直接把分子相加。`,
        `先通分，都分成${N(common)}份。${frac(a, b)}就是${frac(fa, common)}。`,
        `${frac(c, d)}就是${frac(fc, common)}。`,
        `分母一样了，分子相加，等于${frac(result, common)}。`
      ];
    }
    /* —— 乘法：几个几 —— */
    case 'multiplyGroups': {
      const each = data.each != null ? data.each : 3;
      const groups = data.groups != null ? data.groups : 4;
      const product = data.product != null ? data.product : each * groups;
      const u = data.unit || '个';
      return [
        `每${N(each)}个分成一组。`,
        `像这样，一共有${N(groups)}组。`,
        `求一共多少个，用乘法来算。`,
        `${N(each)}乘${N(groups)}，等于${N(product)}。`,
        `一共有${N(product)}${u}。`
      ];
    }
    /* —— 减法：拿走 —— */
    case 'subtractTake': {
      const a = data.a != null ? data.a : 9;
      const b = data.b != null ? data.b : 4;
      const diff = data.diff != null ? data.diff : a - b;
      const u = data.unit || '个';
      return [
        `原来有${N(a)}${u}。`,
        `拿走了${N(b)}${u}。`,
        `从${N(a)}里去掉${N(b)}，就是减法。`,
        `${N(a)}减${N(b)}，等于${N(diff)}。`,
        `还剩${N(diff)}${u}。`
      ];
    }
    /* —— 减法：比多少 —— */
    case 'subtractCompare': {
      const a = data.a != null ? data.a : 15;
      const b = data.b != null ? data.b : 8;
      const diff = data.diff != null ? data.diff : Math.abs(a - b);
      const u = data.unit || '个';
      const big = a >= b ? '甲' : '乙';
      const small = a >= b ? '乙' : '甲';
      return [
        `甲有${N(a)}${u}，乙有${N(b)}${u}。`,
        `谁多谁少？把两份对齐比一比。`,
        `${big}比${small}多出来的那一段，就是相差。`,
        `${N(Math.max(a, b))}减${N(Math.min(a, b))}，等于${N(diff)}。`,
        `相差${N(diff)}${u}。`
      ];
    }
    /* —— 比较大小：排序 —— */
    case 'compareNumbers': {
      const nums = (data.nums && data.nums.length) ? data.nums : [3, 1, 5, 2];
      const asc = nums.slice().sort((x, y) => x - y);
      const desc = asc.slice().reverse();
      const u = data.unit || '个';
      return [
        `比较这些数的大小：${nums.map(N).join('、')}。`,
        `先看位数，位数多的数更大。`,
        `位数一样，就从高位一位一位比。`,
        `从小到大排是：${asc.map(N).join('、')}。`,
        `最大的是${N(desc[0])}，最小的是${N(asc[0])}。`
      ];
    }
    /* —— 小数加减 —— */
    case 'decimalAdd': {
      const a = data.a != null ? data.a : 3.4;
      const b = data.b != null ? data.b : 2.5;
      const op = data.op === 'sub' ? '减' : '加';
      const result = data.result != null ? data.result : (data.op === 'sub' ? a - b : a + b);
      const u = data.unit || '个';
      return [
        `算${N(a)}${op}${N(b)}。`,
        `小数点先对齐，位数不够用零补。`,
        `按整数那样，从最低位加起或减起。`,
        `${N(a)}${op}${N(b)}，等于${N(result)}。`,
        `结果是${N(result)}${u}。`
      ];
    }
    /* —— 认识分数：几分之一/几分之几 —— */
    case 'fractionIntro': {
      const a = data.a != null ? data.a : 1;
      const b = data.b != null ? data.b : 5;
      return [
        `把一个整体，平均分成${N(b)}份。`,
        `其中的${N(a)}份，就可以用分数表示。`,
        `分母${N(b)}，表示平均分成了${N(b)}份。`,
        `分子${N(a)}，表示取了其中的${N(a)}份。`,
        `这个分数就是${frac(a, b)}。`
      ];
    }
    /* —— 除法：平均分 —— */
    case 'divideEqual': {
      const total = data.total != null ? data.total : 12;
      const groups = data.groups != null ? data.groups : 4;
      const each = data.each != null ? data.each : total / groups;
      const u = data.unit || '个';
      return [
        `有${N(total)}${u}，要平均分成${N(groups)}份。`,
        `每份要一样多，这就是平均分。`,
        `求每份是多少，用除法来算。`,
        `${N(total)}除以${N(groups)}，等于${N(each)}。`,
        `每份是${N(each)}${u}。`
      ];
    }
    /* —— 长方形面积 —— */
    case 'rectangleArea': {
      const w = data.w != null ? data.w : 8;
      const h = data.h != null ? data.h : 4;
      const area = data.area != null ? data.area : w * h;
      const u = data.unit || '厘米';
      return [
        `这是一个长方形，长${N(w)}${u}，宽${N(h)}${u}。`,
        `面积就是看它一共能铺满多少个小方格。`,
        `一行能铺${N(w)}个，一共有${N(h)}行。`,
        `长乘宽：${N(w)}乘${N(h)}，等于${N(area)}。`,
        `面积是${N(area)}平方厘米。`
      ];
    }
    /* —— 连加：a+b+c —— */
    case 'chainAdd': {
      const a = data.a != null ? data.a : 3;
      const b = data.b != null ? data.b : 4;
      const c = data.c != null ? data.c : 5;
      const ab = data.ab != null ? data.ab : a + b;
      const sum = data.sum != null ? data.sum : ab + c;
      const u = data.unit || '个';
      return [
        `先算前两个数：${N(a)}加${N(b)}，等于${N(ab)}。`,
        `再把第三个加进来。`,
        `${N(ab)}加${N(c)}，等于${N(sum)}。`,
        `三个数连加，从左到右依次算。`,
        `一共是${N(sum)}${u}。`
      ];
    }
    /* —— 连减 / 加减混合：a-b-c 或 a+b-c —— */
    case 'chainSub': {
      const a = data.a != null ? data.a : 12;
      const b = data.b != null ? data.b : 4;
      const c = data.c != null ? data.c : 3;
      const op1 = data.op1 === 'add' ? '加' : '减';
      const op2 = data.op2 === 'add' ? '加' : '减';
      const x = data.x != null ? data.x : (data.op1 === 'add' ? a + b : a - b);
      const result = data.result != null ? data.result : (data.op2 === 'add' ? x + c : x - c);
      const u = data.unit || '个';
      return [
        `原来是${N(a)}${u}。`,
        `先${op1}${N(b)}，变成${N(x)}。`,
        `再${op2}${N(c)}。`,
        `${N(x)}${op2}${N(c)}，等于${N(result)}。`,
        `按顺序一步步算，结果是${N(result)}${u}。`
      ];
    }
    /* —— 两位数竖式加减（进位/退位） —— */
    case 'columnOp': {
      const a = data.a != null ? data.a : 36;
      const b = data.b != null ? data.b : 18;
      const op = data.op === 'sub' ? '减' : '加';
      const result = data.result != null ? data.result : (data.op === 'sub' ? a - b : a + b);
      const carry = data.op !== 'sub' && (a % 10 + b % 10 >= 10);
      const borrow = data.op === 'sub' && (a % 10 < b % 10);
      const tip = carry ? '个位满十，向十位进一。' : borrow ? '个位不够减，从十位退一当十。' : '个位算完，再算十位。';
      return [
        `算${N(a)}${op}${N(b)}，数位对齐写竖式。`,
        `先从个位算起来。`,
        tip,
        `${N(a)}${op}${N(b)}，等于${N(result)}。`,
        `结果是${N(result)}。`
      ];
    }
    /* —— 概念卡兜底（认识数、测量、几何性质、大数、统计等无法直接运算的节） —— */
    case 'conceptCard': {
      // 概念卡的素材是富文本（markdown + 阿拉伯数字 + 数学符号），必须先过一遍清洗，
      // 否则 TTS 会把 `**1 头**牛` 读成「星号星号一头星号星号牛」。
      const rawTitle = speakable((node && node.title) || '').replace(/[。，；、]$/, '');
      const title = rawTitle || '本节要点';
      const story = pickSentences((node && node.story) || '', 2, 44, { key: true });
      const tip = pickSentences((node && node.wrongTip) || '', 1, 36);

      // 5 句，与 scenes.conceptCard 的 cue(0..4) 一一对应：
      // 标题 → 要点1 → 要点2 → 易错 → 鼓励
      return [
        `这一节讲，${title}。`,
        story[0] || '先看清楚它是什么意思，再动手做题。',
        story[1] || '把概念记牢，做题就不容易错。',
        tip[0] ? `易错提醒，${tip[0]}` : '做题之前，想一想哪里最容易错。',
        '跟着动画再看一遍，然后自己动手做一道题。'
      ];
    }
    default:
      return [`本节点暂用概念卡讲解。`, `先把题意读清楚。`, `再按步骤算。`, `做完记得检查。`];
  }
}

/**
 * 生成旁白时间轴。
 * @param {string} scene 场景名
 * @param {object} data  真实题目数据
 * @param {object} node  原始节点（conceptCard 用 title/wrongTip/story）
 */
function genNarration(scene, data, node) {
  const texts = linesFor(scene, data, node);
  return timeline(texts);
}

module.exports = { genNarration, linesFor, durOf };
