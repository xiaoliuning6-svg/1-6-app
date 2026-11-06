// utils/anim/num2cn.js —— 阿拉伯数字 → 中文读数（给旁白文案用）
//
// 为什么需要：edge-tts 读「1/2」「3+2」会读错（斜杠不读、加号读成「加号」而非「加」），
// 旁白稿里数字一律要手写中文。动画里出现的数字也尽量走中文，和声音对得上。
//
// 支持范围：整数 0 ~ 9999；万级以上自动带「万/亿」单位；小数按位读「点」。
// 分数单独用 frac() 处理（二分之一、六分之三）。
// 为什么支持小数/大数：小数加减、比较大数(如 10000) 会用到，否则 edge-tts 把阿拉伯
// 数字读错、字幕也跟着显示错的数字。

const D1 = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const D2 = ['', '十', '百', '千'];

/** 0~99 的中文（十~十九按口语「十二」而非「一十二」） */
function under100(n) {
  if (n < 10) return D1[n];
  if (n === 10) return '十';
  if (n < 20) return '十' + D1[n % 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return D1[t] + '十' + (o ? D1[o] : '');
}

/** 非整数 → 中文读数（如 12.5 → 十二点五，0.8 → 零点八，3.14 → 三点一四） */
function decimalCn(x) {
  const neg = x < 0;
  const s = Math.abs(x).toString();
  const parts = s.split('.');
  const intPart = parts[0] || '0';
  const decPart = parts[1] || '';
  // 整数部分为 0 时读「零」（如 0.8），否则按整数读法
  let out = (intPart === '0' || intPart === '') ? '零' : num2cn(parseInt(intPart, 10));
  out += '点';
  // 小数部分逐位读，避免「点五」被读成「点五」之外的情况；保证末尾数字清晰
  for (const ch of decPart) out += D1[parseInt(ch, 10)];
  return (neg ? '负' : '') + out;
}

/** 1e4 ~ 1e8-1：带「万」单位（如 10000 → 一万，12345 → 一万二千三百四十五，10001 → 一万零一） */
function withWan(n) {
  const wan = Math.floor(n / 10000);
  const rem = n % 10000;
  let s = num2cn(wan) + '万';
  if (rem === 0) return s;
  if (rem < 1000) s += '零';
  s += num2cn(rem);
  return s;
}

/** 1e8 及以上：带「亿」单位 */
function withYi(n) {
  const yi = Math.floor(n / 100000000);
  const rem = n % 100000000;
  let s = num2cn(yi) + '亿';
  if (rem === 0) return s;
  if (rem < 10000000) s += '零';
  s += num2cn(rem);
  return s;
}

/** 0~9999 的中文 */
function num2cn(n) {
  n = Number(n);
  if (!isFinite(n)) return String(n);
  if (n < 0) return '负' + num2cn(-n);
  // 小数：按位读「点」
  if (!Number.isInteger(n)) return decimalCn(n);
  if (n === 0) return '零';
  if (n < 100) return under100(n);
  if (n < 10000) {
    const th = Math.floor(n / 1000);
    const rem = n % 1000;
    let s = (th ? D1[th] + '千' : '');
    if (rem === 0) return s;
    const h = Math.floor(rem / 100);
    const tail = rem % 100;
    if (h) {
      s += D1[h] + '百';
      if (tail === 0) return s;
      s += tail < 10 ? '零' : '';
    } else {
      s += '零';
    }
    s += under100(tail);
    return s;
  }
  if (n < 100000000) return withWan(n);
  return withYi(n);
}

/** 分数 a/b → 中文「b 分之 a」（a、b 均为正整数） */
function frac(a, b) {
  return num2cn(b) + '分之' + num2cn(a);
}

module.exports = { num2cn, frac, under100, decimalCn };
