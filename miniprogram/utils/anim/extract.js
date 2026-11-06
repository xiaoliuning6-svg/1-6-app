// utils/anim/extract.js —— 从题干里抽数字与运算语义（纯函数，无依赖）
//
// 为什么需要：486 个知识点不可能每个手画，只能「抽到这题的真实数字 → 喂给参数化场景」。
// 小学题干绝大多数是阿拉伯数字（"8 朵""4＋3""14 个"），中文数字为辅；小数用 点/．，
// 分数用 a/b 或「几分之几」。这里只负责把数字和「这是哪种运算」认出来，
// 具体的「a/b 怎么算、和答案对不对」交给 autoMap.js 的安全闸。

/* ---------- 阿拉伯数字（含小数） ---------- */
function parseArabic(text) {
  const out = [];
  const re = /\d+(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ value: parseFloat(m[0]), raw: m[0], index: m.index, cn: false });
  }
  return out;
}

/* ---------- 中文数字：零一二两三四五六七八九十百千 ---------- */
const CN_DIGIT = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const CN_UNIT = { 十: 10, 百: 100, 千: 1000 };

// 把一段连续的中文数字串（如「三十五」「一百二十」「两千零三」）转成数值
function cnNumber(str) {
  // 含「万」先按万分段（小学题极少，但保险）
  if (str.indexOf('万') >= 0) {
    const parts = str.split('万');
    const pre = cnNumber(parts[0] || '');
    const post = parts[1] ? cnNumber(parts[1]) : 0;
    return pre * 10000 + post;
  }
  let total = 0;
  let section = 0; // 当前累积到「遇到下一个大单位前」的小节
  let current = 0;
  for (const ch of str) {
    if (ch in CN_DIGIT) {
      current = CN_DIGIT[ch];
    } else if (ch in CN_UNIT) {
      const u = CN_UNIT[ch];
      if (current === 0) current = 1; // 「十」= 10，「百」= 100
      section += current * u;
      current = 0;
    } else {
      // 非数字字符，小节结束
      total += section;
      section = 0;
      current = 0;
    }
  }
  total += section + current;
  return total;
}

function parseChinese(text) {
  const out = [];
  const re = /[零一二两三四五六七八九十百千]+(?:[零一二两三四五六七八九十百千]|万)*/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const v = cnNumber(m[0]);
    if (v > 0) out.push({ value: v, raw: m[0], index: m.index, cn: true });
  }
  return out;
}

/** 题干里所有数字，按出现顺序，阿拉伯优先去重合并 */
function parseNums(text) {
  const arabic = parseArabic(text);
  const all = arabic.slice();
  // 中文只取阿拉伯没覆盖到的位置，避免「12」被「一十二」重复
  parseChinese(text).forEach((c) => {
    const overlap = arabic.some((a) => c.index >= a.index && c.index < a.index + a.raw.length);
    if (!overlap) all.push(c);
  });
  all.sort((x, y) => x.index - y.index);
  return all.map((x) => x.value);
}

/** 找分数 a/b（阿拉伯「1/2」或中文「二分之一」），返回 [{a,b}, ...] */
function parseFractions(text) {
  const out = [];
  const re = /(\d+)\s*\/\s*(\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ a: parseInt(m[1], 10), b: parseInt(m[2], 10) });
  }
  // 中文「二分之一」「六分之三」
  const cre = /([零一二两三四五六七八九十]+)分之([零一二两三四五六七八九十]+)/g;
  while ((m = cre.exec(text)) !== null) {
    out.push({ a: cnNumber(m[2]), b: cnNumber(m[1]) });
  }
  return out.filter((f) => f.b > 0);
}

function has(text, ...kws) {
  return kws.some((k) => text.indexOf(k) >= 0);
}

/** 取前 n 个数字（不足返回 null） */
function take(nums, n) {
  if (nums.length < n) return null;
  return nums.slice(0, n);
}

module.exports = { parseNums, parseFractions, parseArabic, parseChinese, has, take, cnNumber };
