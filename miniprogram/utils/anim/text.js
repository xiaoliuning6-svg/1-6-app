// utils/anim/text.js —— content.js 富文本 →「能朗读、也能当字幕看」的纯中文
//
// 为什么要这一层：content.js 里的 story / wrongTip 是给学生**看**的富文本，
// 里面混着三种东西，直接丢给 TTS 全会读错：
//   1. markdown       **加粗**、`- ` 列表、`#` 标题
//   2. 阿拉伯数字     1 头牛 / 12.5 / 3600（TTS 会逐位读成「三六零零」）
//   3. 数学符号       4＜6、360÷30、1/3、60 千米/时、30℃（读不出来或读成乱码）
//
// 处理顺序有讲究：百分比 → 分数 → 单位每 → 数字转中文 → 符号读数。
// 前四步都依赖「还是阿拉伯数字」，一旦转了中文就没法区分分子分母了。
//
// 同一份清洗也用于概念卡的**画面**（map.js 的 relation/tip）：那里保留阿拉伯
// 数字（数形对照更直观），但必须去掉 markdown —— 不然画布上会直接画出 `**`。

const { num2cn, frac } = require('./num2cn.js');

/* 常见「每」单位：只有左右都是这些词，斜杠才是「每」而不是并列选项 */
const UNITS = [
  '千米', '公里', '米', '分米', '厘米', '毫米',
  '平方米', '平方厘米', '平方分米', '立方米',
  '千克', '克', '吨', '升', '毫升',
  '小时', '时', '分钟', '分', '秒',
  '元', '角', '本', '个', '支', '人', '次', '天', '页', '棵', '只', '朵'
];

/* 符号 → 读法（放在数字转中文之后执行） */
const SYMBOLS = [
  [/[＞>]/g, '大于'],
  [/[＜<]/g, '小于'],
  [/[＝=]/g, '等于'],
  [/≥/g, '大于等于'],
  [/≤/g, '小于等于'],
  [/≠/g, '不等于'],
  [/[×✕✖]/g, '乘'],
  [/[÷]/g, '除以'],
  [/[＋+]/g, '加'],
  [/[－−]/g, '减'],
  [/[—–]{1,}/g, '，'],
  [/[~～]/g, '到'],
  [/π/g, '派'],
  [/[%％]/g, '百分号'],
  [/…+/g, '，'],
  [/℃/g, '摄氏度'],
  [/°C/g, '摄氏度'],
  [/°/g, '度'],
  [/[·・]/g, '点'],
  [/[“”"]/g, ''],
  [/[\[\]]/g, ''],
  [/\u00a0/g, ' ']
];

/** 净汉字数（判「这句是不是太短」用，标点数字不算） */
function hanziCount(s) {
  return String(s || '').replace(/[^\u4e00-\u9fa5]/g, '').length;
}

/** 去 markdown / HTML，保留文字与标点（供画面显示用） */
function stripMd(s) {
  return String(s == null ? '' : s)
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/^[ \t]*[-*+]\s+/gm, '')   // 无序列表
    .replace(/^[ \t]*\d+[.、)]\s+/gm, '') // 有序列表
    .replace(/^[ \t]*#{1,6}\s*/gm, '')  // 标题
    .replace(/`/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

/** 富文本 → 可朗读中文（数字转中文、符号转读法） */
function speakable(s) {
  let t = stripMd(s);
  if (!t) return '';

  // 1. 百分比：50% → 百分之五十（必须在数字转换前）
  t = t.replace(/(\d+(?:\.\d+)?)\s*[%％]/g, (m, d) => '百分之' + num2cn(parseFloat(d)));

  // 1b. 比：按 2:3 分 → 按 2比3 分（两边都是数字才是比，否则是冒号停顿）
  t = t.replace(/(\d+)\s*[:：]\s*(\d+)/g, '$1比$2');

  // 2. 分数：3/4 → 四分之三（分子分母都是纯数字才认）
  t = t.replace(/(\d+)\s*[/／]\s*(\d+)/g, (m, a, b) => frac(parseInt(a, 10), parseInt(b, 10)));

  // 3. 单位每：60 千米/时 → 千米每时；元/本 → 元每本
  const unitRe = new RegExp('(' + UNITS.join('|') + ')\\s*[/／]\\s*(' + UNITS.join('|') + ')', 'g');
  t = t.replace(unitRe, '$1每$2');

  // 4. 剩下的斜杠是并列选项：一定/可能 → 一定、可能
  t = t.replace(/[/／]/g, '、');

  // 5. 数字 → 中文（含小数，num2cn 已支持到亿）
  t = t.replace(/\d+(?:\.\d+)?/g, (m) => num2cn(parseFloat(m)));

  // 5b. 数字转中文会在数与量词之间留空格（原 `**2 只**鸭` → `二 只鸭`）。
  //     必须在这里先清掉，否则下面的「量词前二读两」匹配不到。两遍是因为
  //     `一 头牛在 吃草` 这种连续多个空格替一次会漏掉相邻位置。
  t = t.replace(/([\u4e00-\u9fa5]) +(?=[\u4e00-\u9fa5])/g, '$1')
       .replace(/([\u4e00-\u9fa5]) +(?=[\u4e00-\u9fa5])/g, '$1');

  // 6. 符号 → 读法
  for (let i = 0; i < SYMBOLS.length; i++) t = t.replace(SYMBOLS[i][0], SYMBOLS[i][1]);

  // 6b. 量词前的「二」读「两」：二只鸭 → 两只鸭。
  //     但「十二只」「二十只」里的二不能换，所以要看前一个字是不是数字。
  //     注意必须把量词一起匹配（前瞻里的捕获组不会进回调参数）。
  t = t.replace(/二(只|个|本|支|次|天|棵|朵|瓶|张|条|头|根|块|元|斤|米|年|月|日|双|对|把|辆|架|台|件|杯|碗|包|盒|层|间|种|类|岁|倍)/g,
    (m, unit, off, str) => {
      const prev = str.charAt(off - 1);
      return /[一二三四五六七八九十百千万亿零两]/.test(prev) ? m : '两' + unit;
    });

  // 7. 收尾：合并重复标点、清掉悬空标点
  t = t
    .replace(/([，。！？；：、])\1+/g, '$1')
    .replace(/[，、；]+。/g, '。')
    .replace(/，{2,}/g, '，')
    .replace(/^[，、；。]+/, '')
    // 数字转中文后会在数字与量词之间留下空格（原 `**3 元**` → `三 元`），
    // 两汉字之间的空格全部删掉，否则 TTS 会在每个量词前顿一下。
    .replace(/([\u4e00-\u9fa5]) +([\u4e00-\u9fa5])/g, '$1$2')
    .replace(/([\u4e00-\u9fa5]) +([\u4e00-\u9fa5])/g, '$1$2')
    .replace(/ +/g, ' ')
    .trim();

  return t;
}

/**
 * 切句：先按段落（\n）分，再按句末标点切。
 * `；` 在题干里是「并列条目」的分隔（"把 3 和 4 弄反；数完 5 不会接着数；"），
 * 直接当句末处理并丢掉 —— 否则拼成字幕会出现「弄反；。」这种标点连用。
 * 以冒号结尾的引导句（"看一组关于祖国的数据："）与下一句合并，冒号换逗号。
 */
function splitSentences(s) {
  const raw = stripMd(s);
  if (!raw) return [];
  const out = [];
  const paras = raw.split(/\n+/);
  for (let p = 0; p < paras.length; p++) {
    const para = paras[p].trim();
    if (!para) continue;
    const parts = para.match(/[^。！？；]*[。！？；]?/g) || [];
    for (let i = 0; i < parts.length; i++) {
      const x = parts[i].trim().replace(/[；;]$/, '');
      if (x) out.push(x);
    }
  }
  // 引导句（以冒号结尾）与下一句合并："求总份数：" + "2加3等于5份"
  const merged = [];
  for (let i = 0; i < out.length; i++) {
    const cur = out[i];
    if (/[：:]$/.test(cur) && i + 1 < out.length) {
      merged.push(cur.slice(0, -1) + '，' + out[i + 1].replace(/^[，、]/, ''));
      i++;
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

/* 「算理句」分强弱：强句讲方法步骤，弱句只是给个结论或举例 */
const KEY_STRONG = /(先算|再算|所以|变成|方法是|算法|口诀|记住|进率|规律|只能|要留)/;
const KEY_WEAK = /(等于|＝|=|就是|表示|叫做|一共|合计|读作)/;

/**
 * 从切好的句子里挑第 2 句要点。
 * 概念卡的前两句常是「情境 + 提问」（"它拿了 4 个面包和 1 瓶饮料，要付多少钱？"），
 * 真正讲算理的那句在后面。所以从第 2 句起，优先取算理句，跳过疑问与碎片。
 * 优先级：强句且长度合适 → 弱句且长度合适 → 强句（接受截断）→ 弱句 → 第一句能用的。
 * 长度合适排在强弱前面：硬截断出来的「等于三。」比少说一句更糟。
 */
function pickKeySentence(sents, fromIdx, maxLen) {
  const start = fromIdx == null ? 1 : fromIdx;
  const okLen = (x) => !maxLen || x.length <= maxLen;
  const usable = (x) => !/[？?]$/.test(x) && x.replace(/[^\u4e00-\u9fa5]/g, '').length >= 6;

  const tiers = [
    (x) => KEY_STRONG.test(x) && okLen(x),
    (x) => KEY_WEAK.test(x) && okLen(x),
    (x) => KEY_STRONG.test(x),
    (x) => KEY_WEAK.test(x),
    () => true
  ];
  for (let k = 0; k < tiers.length; k++) {
    for (let i = start; i < sents.length; i++) {
      if (usable(sents[i]) && tiers[k](sents[i])) return sents[i];
    }
  }
  return '';
}

/** 句子太长时，在最后一个逗号处断开（保留语义完整的前半） */
function clampSentence(s, maxLen) {
  if (!maxLen || s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const i = Math.max(cut.lastIndexOf('，'), cut.lastIndexOf('、'), cut.lastIndexOf('；'));
  // 阈值取 0.35：太靠前的逗号会让句子只剩个开头（"图书角清点新到的书"），
  // 反而丢了要点；宁可留长一点，也不要把算理切没。
  const body = i >= maxLen * 0.35 ? cut.slice(0, i) : cut;
  return body.replace(/[，、；]$/, '') + '。';
}

/**
 * 从富文本里挑 n 句可朗读的完整句子。
 * @param {string} src     story / wrongTip
 * @param {number} n       最多取几句
 * @param {number} maxLen  单句上限（超过在逗号处断）
 * @param {object} opts    {key:true} 表示第 2 句要挑「算理句」而不是顺着取（概念卡用）
 */
function pickSentences(src, n, maxLen, opts) {
  const all = splitSentences(src);
  const out = [];
  const max = maxLen || 42;

  const push = (x) => {
    let s = speakable(x);
    if (!s) return false;
    if (s.replace(/[^\u4e00-\u9fa5]/g, '').length < 4) return false;  // 碎片句丢掉
    s = clampSentence(s, max);
    if (!s) return false;
    if (!/[。！？]$/.test(s)) s += '。';
    if (out.indexOf(s) >= 0) return false;
    out.push(s);
    return true;
  };

  if (!all.length) return out;
  // 第 1 句是导入（"猜数游戏。"），太短就当没有 —— 它只是标题的复述，
  // 念出来像半句话，画面占一行也没有信息量。
  let start = 0;
  if (hanziCount(all[0]) >= 8 && push(all[0])) start = 1;
  if (out.length >= n) return out;

  const wantKey = !!(opts && opts.key);
  if (wantKey) {
    const k = pickKeySentence(all, start, max);
    if (k) push(k);
    if (out.length >= n) return out;
  }

  for (let i = start; i < all.length && out.length < n; i++) {
    if (wantKey && i === start && out.length >= 1) continue;  // 已经用算理句顶替
    push(all[i]);
  }
  return out;
}

/**
 * 同 pickSentences，但保留阿拉伯数字与数学符号（只去 markdown）。
 * 给概念卡**画面**用：数形对照更直观，`1 头牛` 比 `一头牛` 在屏幕上更好认。
 * opts.key 与 pickSentences 语义一致（第 2 句挑算理句）—— 画面和语音必须讲同一件事，
 * 否则会出现「画面写着跳绳比赛、嘴里念着多几少几怎么算」。
 */
function pickRaw(src, n, maxLen, opts) {
  const all = splitSentences(src);
  const out = [];
  const push = (raw) => {
    let x = stripMd(raw).replace(/[ \t]+/g, ' ').trim();
    if (!x) return false;
    if (x.replace(/[^\u4e00-\u9fa5]/g, '').length < 4) return false;
    if (maxLen && x.length > maxLen) {
      const cut = x.slice(0, maxLen);
      const j = Math.max(cut.lastIndexOf('，'), cut.lastIndexOf('、'), cut.lastIndexOf('；'));
      x = (j >= maxLen * 0.5 ? cut.slice(0, j) : cut).replace(/[，、；]$/, '') + '…';
    }
    // 省略号已经表示「后面还有」，别再补句号，否则画面上是「圆柱的特点…。」
    if (!/[。！？，、；…]$/.test(x)) x += '。';
    if (out.indexOf(x) >= 0) return false;
    out.push(x);
    return true;
  };

  if (!all.length) return out;
  let start = 0;
  if (hanziCount(all[0]) >= 8 && push(all[0])) start = 1;
  if (out.length >= n) return out;

  const wantKey = !!(opts && opts.key);
  if (wantKey) {
    const k = pickKeySentence(all, start, maxLen);
    if (k) push(k);
    if (out.length >= n) return out;
  }
  for (let i = start; i < all.length && out.length < n; i++) {
    if (wantKey && i === start && out.length >= 1) continue;
    push(all[i]);
  }
  return out;
}

module.exports = { stripMd, speakable, splitSentences, clampSentence, pickSentences, pickRaw };
