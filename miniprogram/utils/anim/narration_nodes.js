// utils/anim/narration_nodes.js —— 运算动画节点的预打包逐句旁白（per-node）
//
// ⚠️ 本文件由 tools/pack_audio_subpackages.js 自动生成，不要手改。
//    文案来自 tools/_anim_narration_dump.json；mp3 由 tools/gen_node_audio.py 生成。
//    改文案 → 重跑 dump → gen_node_audio.py → pack_audio_subpackages.js。
//
// 微信单个分包上限 2048KB，58 节点语音按体积切进 assets2/3/4 三个分包；
// file 是从 miniprogram 根算起的完整路径；NODE_SUBPKG 记录节点所属分包名，
// learn 页按需 wx.loadSubpackage 对应分包后再播。

const NARRATION_NODES = {
  'bsd-g1s-001': {
    total: 14.86,
    lines: [
      { t: 0, dur: 3.05, text: '左边有八个，右边有一个。', file: 'assets3/bsd-g1s-001/0.mp3' },
      { t: 3.23, dur: 3.36, text: '把两堆放到一起，就是合起来。', file: 'assets3/bsd-g1s-001/1.mp3' },
      { t: 6.77, dur: 2.74, text: '合起来，用加法来算。', file: 'assets3/bsd-g1s-001/2.mp3' },
      { t: 9.68, dur: 2.35, text: '八加一，等于九。', file: 'assets3/bsd-g1s-001/3.mp3' },
      { t: 12.22, dur: 1.85, text: '一共有九朵。', file: 'assets3/bsd-g1s-001/4.mp3' },
    ]
  },
  'bsd-g1s-002': {
    total: 18.37,
    lines: [
      { t: 0, dur: 3.53, text: '比较这些数的大小：五、七。', file: 'assets2/bsd-g1s-002/0.mp3' },
      { t: 3.71, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets2/bsd-g1s-002/1.mp3' },
      { t: 7.3, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets2/bsd-g1s-002/2.mp3' },
      { t: 10.98, dur: 3.29, text: '从小到大排是：五、七。', file: 'assets2/bsd-g1s-002/3.mp3' },
      { t: 14.45, dur: 3.12, text: '最大的是七，最小的是五。', file: 'assets2/bsd-g1s-002/4.mp3' },
    ]
  },
  'bsd-g1s-004': {
    total: 20.5,
    lines: [
      { t: 0, dur: 4.56, text: '比较这些数的大小：三、一、五、二。', file: 'assets1/bsd-g1s-004/0.mp3' },
      { t: 4.74, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g1s-004/1.mp3' },
      { t: 8.33, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g1s-004/2.mp3' },
      { t: 12.01, dur: 4.39, text: '从小到大排是：一、二、三、五。', file: 'assets1/bsd-g1s-004/3.mp3' },
      { t: 16.58, dur: 3.12, text: '最大的是五，最小的是一。', file: 'assets1/bsd-g1s-004/4.mp3' },
    ]
  },
  'bsd-g1s-006': {
    total: 18.46,
    lines: [
      { t: 0, dur: 3.55, text: '比较这些数的大小：八、十。', file: 'assets2/bsd-g1s-006/0.mp3' },
      { t: 3.73, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets2/bsd-g1s-006/1.mp3' },
      { t: 7.32, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets2/bsd-g1s-006/2.mp3' },
      { t: 11, dur: 3.36, text: '从小到大排是：八、十。', file: 'assets2/bsd-g1s-006/3.mp3' },
      { t: 14.54, dur: 3.12, text: '最大的是十，最小的是八。', file: 'assets2/bsd-g1s-006/4.mp3' },
    ]
  },
  'bsd-g1s-008': {
    total: 16.28,
    lines: [
      { t: 0, dur: 2.66, text: '甲有五个，乙有六个。', file: 'assets3/bsd-g1s-008/0.mp3' },
      { t: 2.84, dur: 4.39, text: '谁多谁少？把两份对齐比一比。', file: 'assets3/bsd-g1s-008/1.mp3' },
      { t: 7.42, dur: 3.67, text: '乙比甲多出来的那一段，就是相差。', file: 'assets3/bsd-g1s-008/2.mp3' },
      { t: 11.27, dur: 2.33, text: '六减五，等于一。', file: 'assets3/bsd-g1s-008/3.mp3' },
      { t: 13.78, dur: 1.7, text: '相差一个。', file: 'assets3/bsd-g1s-008/4.mp3' },
    ]
  },
  'bsd-g1s-011': {
    total: 12.46,
    lines: [
      { t: 0, dur: 1.82, text: '原来有五只。', file: 'assets3/bsd-g1s-011/0.mp3' },
      { t: 2, dur: 1.85, text: '拿走了三只。', file: 'assets3/bsd-g1s-011/1.mp3' },
      { t: 4.03, dur: 3.14, text: '从五里去掉三，就是减法。', file: 'assets3/bsd-g1s-011/2.mp3' },
      { t: 7.36, dur: 2.35, text: '五减三，等于二。', file: 'assets3/bsd-g1s-011/3.mp3' },
      { t: 9.89, dur: 1.78, text: '还剩二只。', file: 'assets3/bsd-g1s-011/4.mp3' },
    ]
  },
  'bsd-g1s-013': {
    total: 15.1,
    lines: [
      { t: 0, dur: 3.12, text: '左边有四个，右边有六个。', file: 'assets3/bsd-g1s-013/0.mp3' },
      { t: 3.3, dur: 3.36, text: '把两堆放到一起，就是合起来。', file: 'assets3/bsd-g1s-013/1.mp3' },
      { t: 6.84, dur: 2.74, text: '合起来，用加法来算。', file: 'assets3/bsd-g1s-013/2.mp3' },
      { t: 9.76, dur: 2.5, text: '四加六，等于十。', file: 'assets3/bsd-g1s-013/3.mp3' },
      { t: 12.43, dur: 1.87, text: '一共有十个。', file: 'assets3/bsd-g1s-013/4.mp3' },
    ]
  },
  'bsd-g1s-027': {
    total: 15.08,
    lines: [
      { t: 0, dur: 3.14, text: '左边有四个，右边有三个。', file: 'assets3/bsd-g1s-027/0.mp3' },
      { t: 3.32, dur: 3.36, text: '把两堆放到一起，就是合起来。', file: 'assets3/bsd-g1s-027/1.mp3' },
      { t: 6.86, dur: 2.74, text: '合起来，用加法来算。', file: 'assets3/bsd-g1s-027/2.mp3' },
      { t: 9.78, dur: 2.45, text: '四加三，等于七。', file: 'assets3/bsd-g1s-027/3.mp3' },
      { t: 12.41, dur: 1.87, text: '一共有七个。', file: 'assets3/bsd-g1s-027/4.mp3' },
    ]
  },
  'bsd-g1x-019': {
    total: 16.76,
    lines: [
      { t: 0, dur: 2.86, text: '甲有十五个，乙有八个。', file: 'assets3/bsd-g1x-019/0.mp3' },
      { t: 3.04, dur: 4.39, text: '谁多谁少？把两份对齐比一比。', file: 'assets3/bsd-g1x-019/1.mp3' },
      { t: 7.61, dur: 3.6, text: '甲比乙多出来的那一段，就是相差。', file: 'assets3/bsd-g1x-019/2.mp3' },
      { t: 11.39, dur: 2.57, text: '十五减八，等于七。', file: 'assets3/bsd-g1x-019/3.mp3' },
      { t: 14.14, dur: 1.82, text: '相差七个。', file: 'assets3/bsd-g1x-019/4.mp3' },
    ]
  },
  'bsd-g1x-024': {
    total: 20.62,
    lines: [
      { t: 0, dur: 4.27, text: '比较这些数的大小：七十三、七十九。', file: 'assets1/bsd-g1x-024/0.mp3' },
      { t: 4.45, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g1x-024/1.mp3' },
      { t: 8.04, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g1x-024/2.mp3' },
      { t: 11.72, dur: 4.03, text: '从小到大排是：七十三、七十九。', file: 'assets1/bsd-g1x-024/3.mp3' },
      { t: 15.94, dur: 3.89, text: '最大的是七十九，最小的是七十三。', file: 'assets1/bsd-g1x-024/4.mp3' },
    ]
  },
  'bsd-g1x-025': {
    total: 20.84,
    lines: [
      { t: 0, dur: 4.68, text: '比较这些数的大小：九十、四十二、一。', file: 'assets1/bsd-g1x-025/0.mp3' },
      { t: 4.86, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g1x-025/1.mp3' },
      { t: 8.45, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g1x-025/2.mp3' },
      { t: 12.13, dur: 4.44, text: '从小到大排是：一、四十二、九十。', file: 'assets1/bsd-g1x-025/3.mp3' },
      { t: 16.75, dur: 3.29, text: '最大的是九十，最小的是一。', file: 'assets1/bsd-g1x-025/4.mp3' },
    ]
  },
  'bsd-g1x-032': {
    total: 23.1,
    lines: [
      { t: 0, dur: 5.69, text: '比较这些数的大小：四十二、六、三十六、四十三。', file: 'assets1/bsd-g1x-032/0.mp3' },
      { t: 5.87, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g1x-032/1.mp3' },
      { t: 9.46, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g1x-032/2.mp3' },
      { t: 13.14, dur: 5.42, text: '从小到大排是：六、三十六、四十二、四十三。', file: 'assets1/bsd-g1x-032/3.mp3' },
      { t: 18.74, dur: 3.55, text: '最大的是四十三，最小的是六。', file: 'assets1/bsd-g1x-032/4.mp3' },
    ]
  },
  'bsd-g1x-033': {
    total: 17.38,
    lines: [
      { t: 0, dur: 3.17, text: '甲有二十五个，乙有十八个。', file: 'assets2/bsd-g1x-033/0.mp3' },
      { t: 3.35, dur: 4.39, text: '谁多谁少？把两份对齐比一比。', file: 'assets2/bsd-g1x-033/1.mp3' },
      { t: 7.92, dur: 3.6, text: '甲比乙多出来的那一段，就是相差。', file: 'assets2/bsd-g1x-033/2.mp3' },
      { t: 11.7, dur: 2.88, text: '二十五减十八，等于七。', file: 'assets2/bsd-g1x-033/3.mp3' },
      { t: 14.76, dur: 1.82, text: '相差七个。', file: 'assets2/bsd-g1x-033/4.mp3' },
    ]
  },
  'bsd-g1x-040': {
    total: 12.61,
    lines: [
      { t: 0, dur: 1.9, text: '原来有七角。', file: 'assets1/bsd-g1x-040/0.mp3' },
      { t: 2.08, dur: 1.85, text: '拿走了三角。', file: 'assets1/bsd-g1x-040/1.mp3' },
      { t: 4.1, dur: 3.19, text: '从七里去掉三，就是减法。', file: 'assets1/bsd-g1x-040/2.mp3' },
      { t: 7.48, dur: 2.4, text: '七减三，等于四。', file: 'assets1/bsd-g1x-040/3.mp3' },
      { t: 10.06, dur: 1.75, text: '还剩四角。', file: 'assets1/bsd-g1x-040/4.mp3' },
    ]
  },
  'bsd-g2s-006': {
    total: 13.26,
    lines: [
      { t: 0, dur: 1.82, text: '原来是二分。', file: 'assets3/bsd-g2s-006/0.mp3' },
      { t: 2, dur: 2.47, text: '先加一，变成三。', file: 'assets3/bsd-g2s-006/1.mp3' },
      { t: 4.66, dur: 1.49, text: '再减一。', file: 'assets3/bsd-g2s-006/2.mp3' },
      { t: 6.32, dur: 2.38, text: '三减一，等于二。', file: 'assets3/bsd-g2s-006/3.mp3' },
      { t: 8.88, dur: 3.58, text: '按顺序一步步算，结果是二分。', file: 'assets3/bsd-g2s-006/4.mp3' },
    ]
  },
  'bsd-g2s-008': {
    total: 19.66,
    lines: [
      { t: 0, dur: 4.15, text: '比较这些数的大小：四、一、四。', file: 'assets2/bsd-g2s-008/0.mp3' },
      { t: 4.33, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets2/bsd-g2s-008/1.mp3' },
      { t: 7.92, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets2/bsd-g2s-008/2.mp3' },
      { t: 11.6, dur: 3.94, text: '从小到大排是：一、四、四。', file: 'assets2/bsd-g2s-008/3.mp3' },
      { t: 15.72, dur: 3.14, text: '最大的是四，最小的是一。', file: 'assets2/bsd-g2s-008/4.mp3' },
    ]
  },
  'bsd-g2s-013': {
    total: 14.38,
    lines: [
      { t: 0, dur: 2.23, text: '每四个分成一组。', file: 'assets3/bsd-g2s-013/0.mp3' },
      { t: 2.41, dur: 2.71, text: '像这样，一共有五组。', file: 'assets3/bsd-g2s-013/1.mp3' },
      { t: 5.3, dur: 3.26, text: '求一共多少个，用乘法来算。', file: 'assets3/bsd-g2s-013/2.mp3' },
      { t: 8.75, dur: 2.66, text: '四乘五，等于二十。', file: 'assets3/bsd-g2s-013/3.mp3' },
      { t: 11.59, dur: 1.99, text: '一共有二十个。', file: 'assets3/bsd-g2s-013/4.mp3' },
    ]
  },
  'bsd-g2s-014': {
    total: 14.34,
    lines: [
      { t: 0, dur: 2.21, text: '每三个分成一组。', file: 'assets3/bsd-g2s-014/0.mp3' },
      { t: 2.39, dur: 2.76, text: '像这样，一共有四组。', file: 'assets3/bsd-g2s-014/1.mp3' },
      { t: 5.33, dur: 3.26, text: '求一共多少个，用乘法来算。', file: 'assets3/bsd-g2s-014/2.mp3' },
      { t: 8.77, dur: 2.54, text: '三乘四，等于十二。', file: 'assets3/bsd-g2s-014/3.mp3' },
      { t: 11.5, dur: 2.04, text: '一共有十二只。', file: 'assets3/bsd-g2s-014/4.mp3' },
    ]
  },
  'bsd-g2s-015': {
    total: 14.34,
    lines: [
      { t: 0, dur: 2.23, text: '每四个分成一组。', file: 'assets3/bsd-g2s-015/0.mp3' },
      { t: 2.41, dur: 2.78, text: '像这样，一共有三组。', file: 'assets3/bsd-g2s-015/1.mp3' },
      { t: 5.38, dur: 3.26, text: '求一共多少个，用乘法来算。', file: 'assets3/bsd-g2s-015/2.mp3' },
      { t: 8.82, dur: 2.57, text: '四乘三，等于十二。', file: 'assets3/bsd-g2s-015/3.mp3' },
      { t: 11.57, dur: 1.97, text: '一共有十二个。', file: 'assets3/bsd-g2s-015/4.mp3' },
    ]
  },
  'bsd-g2s-023': {
    total: 16.06,
    lines: [
      { t: 0, dur: 3.24, text: '有八分，要平均分成二份。', file: 'assets3/bsd-g2s-023/0.mp3' },
      { t: 3.42, dur: 3.43, text: '每份要一样多，这就是平均分。', file: 'assets3/bsd-g2s-023/1.mp3' },
      { t: 7.03, dur: 3.43, text: '求每份是多少，用除法来算。', file: 'assets3/bsd-g2s-023/2.mp3' },
      { t: 10.64, dur: 2.5, text: '八除以二，等于四。', file: 'assets3/bsd-g2s-023/3.mp3' },
      { t: 13.32, dur: 1.94, text: '每份是四分。', file: 'assets3/bsd-g2s-023/4.mp3' },
    ]
  },
  'bsd-g2s-024': {
    total: 16.14,
    lines: [
      { t: 0, dur: 3.26, text: '有十分，要平均分成五份。', file: 'assets3/bsd-g2s-024/0.mp3' },
      { t: 3.44, dur: 3.43, text: '每份要一样多，这就是平均分。', file: 'assets3/bsd-g2s-024/1.mp3' },
      { t: 7.06, dur: 3.43, text: '求每份是多少，用除法来算。', file: 'assets3/bsd-g2s-024/2.mp3' },
      { t: 10.67, dur: 2.57, text: '十除以五，等于二。', file: 'assets3/bsd-g2s-024/3.mp3' },
      { t: 13.42, dur: 1.92, text: '每份是二分。', file: 'assets3/bsd-g2s-024/4.mp3' },
    ]
  },
  'bsd-g2s-026': {
    total: 16.38,
    lines: [
      { t: 0, dur: 3.34, text: '有二十分，要平均分成五份。', file: 'assets3/bsd-g2s-026/0.mp3' },
      { t: 3.52, dur: 3.43, text: '每份要一样多，这就是平均分。', file: 'assets3/bsd-g2s-026/1.mp3' },
      { t: 7.13, dur: 3.43, text: '求每份是多少，用除法来算。', file: 'assets3/bsd-g2s-026/2.mp3' },
      { t: 10.74, dur: 2.71, text: '二十除以五，等于四。', file: 'assets3/bsd-g2s-026/3.mp3' },
      { t: 13.63, dur: 1.94, text: '每份是四分。', file: 'assets3/bsd-g2s-026/4.mp3' },
    ]
  },
  'bsd-g2s-037': {
    total: 14.26,
    lines: [
      { t: 0, dur: 2.18, text: '每八个分成一组。', file: 'assets3/bsd-g2s-037/0.mp3' },
      { t: 2.36, dur: 2.71, text: '像这样，一共有五组。', file: 'assets3/bsd-g2s-037/1.mp3' },
      { t: 5.26, dur: 3.26, text: '求一共多少个，用乘法来算。', file: 'assets3/bsd-g2s-037/2.mp3' },
      { t: 8.7, dur: 2.59, text: '八乘五，等于四十。', file: 'assets3/bsd-g2s-037/3.mp3' },
      { t: 11.47, dur: 1.99, text: '一共有四十米。', file: 'assets3/bsd-g2s-037/4.mp3' },
    ]
  },
  'bsd-g2x-019': {
    total: 22.52,
    lines: [
      { t: 0, dur: 4.8, text: '比较这些数的大小：九百九十八、一千零一。', file: 'assets1/bsd-g2x-019/0.mp3' },
      { t: 4.98, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g2x-019/1.mp3' },
      { t: 8.57, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g2x-019/2.mp3' },
      { t: 12.25, dur: 4.68, text: '从小到大排是：九百九十八、一千零一。', file: 'assets1/bsd-g2x-019/3.mp3' },
      { t: 17.11, dur: 4.61, text: '最大的是一千零一，最小的是九百九十八。', file: 'assets1/bsd-g2x-019/4.mp3' },
    ]
  },
  'bsd-g2x-027': {
    total: 18.39,
    lines: [
      { t: 0, dur: 4.99, text: '算三百十六加二百七十二，数位对齐写竖式。', file: 'assets2/bsd-g2x-027/0.mp3' },
      { t: 5.17, dur: 2.21, text: '先从个位算起来。', file: 'assets2/bsd-g2x-027/1.mp3' },
      { t: 7.56, dur: 2.81, text: '个位算完，再算十位。', file: 'assets2/bsd-g2x-027/2.mp3' },
      { t: 10.55, dur: 4.49, text: '三百十六加二百七十二，等于五百八十八。', file: 'assets2/bsd-g2x-027/3.mp3' },
      { t: 15.22, dur: 2.38, text: '结果是五百八十八。', file: 'assets2/bsd-g2x-027/4.mp3' },
    ]
  },
  'bsd-g2x-032': {
    total: 18.06,
    lines: [
      { t: 0, dur: 2.57, text: '原来有七百二十米。', file: 'assets2/bsd-g2x-032/0.mp3' },
      { t: 2.75, dur: 2.5, text: '拿走了二百六十五米。', file: 'assets2/bsd-g2x-032/1.mp3' },
      { t: 5.42, dur: 4.56, text: '从七百二十里去掉二百六十五，就是减法。', file: 'assets2/bsd-g2x-032/2.mp3' },
      { t: 10.16, dur: 4.44, text: '七百二十减二百六十五，等于四百五十五。', file: 'assets2/bsd-g2x-032/3.mp3' },
      { t: 14.78, dur: 2.47, text: '还剩四百五十五米。', file: 'assets2/bsd-g2x-032/4.mp3' },
    ]
  },
  'bsd-g2x-038': {
    total: 18.25,
    lines: [
      { t: 0, dur: 3.48, text: '比较这些数的大小：二、一。', file: 'assets2/bsd-g2x-038/0.mp3' },
      { t: 3.66, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets2/bsd-g2x-038/1.mp3' },
      { t: 7.25, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets2/bsd-g2x-038/2.mp3' },
      { t: 10.93, dur: 3.24, text: '从小到大排是：一、二。', file: 'assets2/bsd-g2x-038/3.mp3' },
      { t: 14.35, dur: 3.1, text: '最大的是二，最小的是一。', file: 'assets2/bsd-g2x-038/4.mp3' },
    ]
  },
  'bsd-g3s-003': {
    total: 14.41,
    lines: [
      { t: 0, dur: 2.16, text: '原来是四十五个。', file: 'assets3/bsd-g3s-003/0.mp3' },
      { t: 2.34, dur: 3.05, text: '先减二十七，变成十八。', file: 'assets3/bsd-g3s-003/1.mp3' },
      { t: 5.57, dur: 1.54, text: '再减九。', file: 'assets3/bsd-g3s-003/2.mp3' },
      { t: 7.28, dur: 2.64, text: '十八减九，等于九。', file: 'assets3/bsd-g3s-003/3.mp3' },
      { t: 10.1, dur: 3.5, text: '按顺序一步步算，结果是九个。', file: 'assets3/bsd-g3s-003/4.mp3' },
    ]
  },
  'bsd-g3s-019': {
    total: 12.32,
    lines: [
      { t: 0, dur: 1.87, text: '原来有二角。', file: 'assets3/bsd-g3s-019/0.mp3' },
      { t: 2.05, dur: 1.82, text: '拿走了一角。', file: 'assets3/bsd-g3s-019/1.mp3' },
      { t: 4.06, dur: 3.07, text: '从二里去掉一，就是减法。', file: 'assets3/bsd-g3s-019/2.mp3' },
      { t: 7.31, dur: 2.33, text: '二减一，等于一。', file: 'assets3/bsd-g3s-019/3.mp3' },
      { t: 9.82, dur: 1.7, text: '还剩一角。', file: 'assets3/bsd-g3s-019/4.mp3' },
    ]
  },
  'bsd-g3s-023': {
    total: 15.44,
    lines: [
      { t: 0, dur: 4.06, text: '先算前两个数：二加三，等于五。', file: 'assets3/bsd-g3s-023/0.mp3' },
      { t: 4.24, dur: 2.26, text: '再把第三个加进来。', file: 'assets3/bsd-g3s-023/1.mp3' },
      { t: 6.67, dur: 2.33, text: '五加一，等于六。', file: 'assets3/bsd-g3s-023/2.mp3' },
      { t: 9.18, dur: 3.46, text: '三个数连加，从左到右依次算。', file: 'assets3/bsd-g3s-023/3.mp3' },
      { t: 12.82, dur: 1.82, text: '一共是六个。', file: 'assets3/bsd-g3s-023/4.mp3' },
    ]
  },
  'bsd-g3s-029': {
    total: 21.46,
    lines: [
      { t: 0, dur: 4.51, text: '比较这些数的大小：零点九、零点八五。', file: 'assets1/bsd-g3s-029/0.mp3' },
      { t: 4.69, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g3s-029/1.mp3' },
      { t: 8.28, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g3s-029/2.mp3' },
      { t: 11.96, dur: 4.34, text: '从小到大排是：零点八五、零点九。', file: 'assets1/bsd-g3s-029/3.mp3' },
      { t: 16.49, dur: 4.18, text: '最大的是零点九，最小的是零点八五。', file: 'assets1/bsd-g3s-029/4.mp3' },
    ]
  },
  'bsd-g3s-030': {
    total: 18.22,
    lines: [
      { t: 0, dur: 2.76, text: '算十二点五减六点八。', file: 'assets2/bsd-g3s-030/0.mp3' },
      { t: 2.94, dur: 3.86, text: '小数点先对齐，位数不够用零补。', file: 'assets2/bsd-g3s-030/1.mp3' },
      { t: 6.98, dur: 4.06, text: '按整数那样，从最低位加起或减起。', file: 'assets2/bsd-g3s-030/2.mp3' },
      { t: 11.22, dur: 3.79, text: '十二点五减六点八，等于五点七。', file: 'assets2/bsd-g3s-030/3.mp3' },
      { t: 15.19, dur: 2.23, text: '结果是五点七个。', file: 'assets2/bsd-g3s-030/4.mp3' },
    ]
  },
  'bsd-g3x-013': {
    total: 14.94,
    lines: [
      { t: 0, dur: 3.14, text: '左边有四个，右边有二个。', file: 'assets3/bsd-g3x-013/0.mp3' },
      { t: 3.32, dur: 3.36, text: '把两堆放到一起，就是合起来。', file: 'assets3/bsd-g3x-013/1.mp3' },
      { t: 6.86, dur: 2.74, text: '合起来，用加法来算。', file: 'assets3/bsd-g3x-013/2.mp3' },
      { t: 9.78, dur: 2.35, text: '四加二，等于六。', file: 'assets3/bsd-g3x-013/3.mp3' },
      { t: 12.31, dur: 1.82, text: '一共有六个。', file: 'assets3/bsd-g3x-013/4.mp3' },
    ]
  },
  'bsd-g3x-036': {
    total: 22.57,
    lines: [
      { t: 0, dur: 5.42, text: '比较这些数的大小：四十五、六、四十五、七。', file: 'assets1/bsd-g3x-036/0.mp3' },
      { t: 5.6, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g3x-036/1.mp3' },
      { t: 9.19, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g3x-036/2.mp3' },
      { t: 12.88, dur: 5.23, text: '从小到大排是：六、七、四十五、四十五。', file: 'assets1/bsd-g3x-036/3.mp3' },
      { t: 18.29, dur: 3.48, text: '最大的是四十五，最小的是六。', file: 'assets1/bsd-g3x-036/4.mp3' },
    ]
  },
  'bsd-g4s-003': {
    total: 18.75,
    lines: [
      { t: 0, dur: 3.6, text: '比较这些数的大小：一、一万。', file: 'assets2/bsd-g4s-003/0.mp3' },
      { t: 3.78, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets2/bsd-g4s-003/1.mp3' },
      { t: 7.37, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets2/bsd-g4s-003/2.mp3' },
      { t: 11.05, dur: 3.43, text: '从小到大排是：一、一万。', file: 'assets2/bsd-g4s-003/3.mp3' },
      { t: 14.66, dur: 3.29, text: '最大的是一万，最小的是一。', file: 'assets2/bsd-g4s-003/4.mp3' },
    ]
  },
  'bsd-g4s-022': {
    total: 20.17,
    lines: [
      { t: 0, dur: 4.15, text: '比较这些数的大小：二十五、十六。', file: 'assets1/bsd-g4s-022/0.mp3' },
      { t: 4.33, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g4s-022/1.mp3' },
      { t: 7.92, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g4s-022/2.mp3' },
      { t: 11.6, dur: 3.89, text: '从小到大排是：十六、二十五。', file: 'assets1/bsd-g4s-022/3.mp3' },
      { t: 15.67, dur: 3.7, text: '最大的是二十五，最小的是十六。', file: 'assets1/bsd-g4s-022/4.mp3' },
    ]
  },
  'bsd-g4s-032': {
    total: 15.39,
    lines: [
      { t: 0, dur: 3.94, text: '先算前两个数：一加四，等于五。', file: 'assets3/bsd-g4s-032/0.mp3' },
      { t: 4.12, dur: 2.26, text: '再把第三个加进来。', file: 'assets3/bsd-g4s-032/1.mp3' },
      { t: 6.55, dur: 2.33, text: '五加一，等于六。', file: 'assets3/bsd-g4s-032/2.mp3' },
      { t: 9.06, dur: 3.46, text: '三个数连加，从左到右依次算。', file: 'assets3/bsd-g4s-032/3.mp3' },
      { t: 12.7, dur: 1.9, text: '一共是六角。', file: 'assets3/bsd-g4s-032/4.mp3' },
    ]
  },
  'bsd-g4s-038': {
    total: 21.34,
    lines: [
      { t: 0, dur: 4.94, text: '比较这些数的大小：二百四十、一千、三。', file: 'assets1/bsd-g4s-038/0.mp3' },
      { t: 5.12, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g4s-038/1.mp3' },
      { t: 8.71, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g4s-038/2.mp3' },
      { t: 12.4, dur: 4.68, text: '从小到大排是：三、二百四十、一千。', file: 'assets1/bsd-g4s-038/3.mp3' },
      { t: 17.26, dur: 3.29, text: '最大的是一千，最小的是三。', file: 'assets1/bsd-g4s-038/4.mp3' },
    ]
  },
  'bsd-g4s-041': {
    total: 20.5,
    lines: [
      { t: 0, dur: 4.58, text: '比较这些数的大小：一、五、五、七。', file: 'assets1/bsd-g4s-041/0.mp3' },
      { t: 4.76, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g4s-041/1.mp3' },
      { t: 8.35, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g4s-041/2.mp3' },
      { t: 12.04, dur: 4.34, text: '从小到大排是：一、五、五、七。', file: 'assets1/bsd-g4s-041/3.mp3' },
      { t: 16.56, dur: 3.14, text: '最大的是七，最小的是一。', file: 'assets1/bsd-g4s-041/4.mp3' },
    ]
  },
  'bsd-g4x-007': {
    total: 21.01,
    lines: [
      { t: 0, dur: 4.8, text: '比较这些数的大小：一、三、一百、三。', file: 'assets1/bsd-g4x-007/0.mp3' },
      { t: 4.98, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g4x-007/1.mp3' },
      { t: 8.57, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g4x-007/2.mp3' },
      { t: 12.25, dur: 4.56, text: '从小到大排是：一、三、三、一百。', file: 'assets1/bsd-g4x-007/3.mp3' },
      { t: 16.99, dur: 3.22, text: '最大的是一百，最小的是一。', file: 'assets1/bsd-g4x-007/4.mp3' },
    ]
  },
  'bsd-g4x-014': {
    total: 18.56,
    lines: [
      { t: 0, dur: 3.58, text: '比较这些数的大小：四、三。', file: 'assets2/bsd-g4x-014/0.mp3' },
      { t: 3.76, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets2/bsd-g4x-014/1.mp3' },
      { t: 7.34, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets2/bsd-g4x-014/2.mp3' },
      { t: 11.03, dur: 3.36, text: '从小到大排是：三、四。', file: 'assets2/bsd-g4x-014/3.mp3' },
      { t: 14.57, dur: 3.19, text: '最大的是四，最小的是三。', file: 'assets2/bsd-g4x-014/4.mp3' },
    ]
  },
  'bsd-g4x-018': {
    total: 14.94,
    lines: [
      { t: 0, dur: 2.93, text: '左边有一个，右边有一个。', file: 'assets3/bsd-g4x-018/0.mp3' },
      { t: 3.11, dur: 3.36, text: '把两堆放到一起，就是合起来。', file: 'assets3/bsd-g4x-018/1.mp3' },
      { t: 6.65, dur: 2.74, text: '合起来，用加法来算。', file: 'assets3/bsd-g4x-018/2.mp3' },
      { t: 9.56, dur: 2.3, text: '一加一，等于二。', file: 'assets3/bsd-g4x-018/3.mp3' },
      { t: 12.05, dur: 2.09, text: '一共有二千克。', file: 'assets3/bsd-g4x-018/4.mp3' },
    ]
  },
  'bsd-g4x-033': {
    total: 19.93,
    lines: [
      { t: 0, dur: 4.39, text: '这是一个长方形，长八厘米，宽四厘米。', file: 'assets1/bsd-g4x-033/0.mp3' },
      { t: 4.57, dur: 4.25, text: '面积就是看它一共能铺满多少个小方格。', file: 'assets1/bsd-g4x-033/1.mp3' },
      { t: 9, dur: 3.24, text: '一行能铺八个，一共有四行。', file: 'assets1/bsd-g4x-033/2.mp3' },
      { t: 12.42, dur: 3.7, text: '长乘宽：八乘四，等于三十二。', file: 'assets1/bsd-g4x-033/3.mp3' },
      { t: 16.3, dur: 2.83, text: '面积是三十二平方厘米。', file: 'assets1/bsd-g4x-033/4.mp3' },
    ]
  },
  'bsd-g4x-037': {
    total: 19.33,
    lines: [
      { t: 0, dur: 4.01, text: '比较这些数的大小：八、二、二。', file: 'assets2/bsd-g4x-037/0.mp3' },
      { t: 4.19, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets2/bsd-g4x-037/1.mp3' },
      { t: 7.78, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets2/bsd-g4x-037/2.mp3' },
      { t: 11.46, dur: 3.84, text: '从小到大排是：二、二、八。', file: 'assets2/bsd-g4x-037/3.mp3' },
      { t: 15.48, dur: 3.05, text: '最大的是八，最小的是二。', file: 'assets2/bsd-g4x-037/4.mp3' },
    ]
  },
  'bsd-g4x-039': {
    total: 14.1,
    lines: [
      { t: 0, dur: 2.21, text: '每三个分成一组。', file: 'assets3/bsd-g4x-039/0.mp3' },
      { t: 2.39, dur: 2.78, text: '像这样，一共有三组。', file: 'assets3/bsd-g4x-039/1.mp3' },
      { t: 5.35, dur: 3.26, text: '求一共多少个，用乘法来算。', file: 'assets3/bsd-g4x-039/2.mp3' },
      { t: 8.8, dur: 2.47, text: '三乘三，等于九。', file: 'assets3/bsd-g4x-039/3.mp3' },
      { t: 11.45, dur: 1.85, text: '一共有九分。', file: 'assets3/bsd-g4x-039/4.mp3' },
    ]
  },
  'bsd-g4x-040': {
    total: 18.32,
    lines: [
      { t: 0, dur: 3.36, text: '把一个整体，平均分成五份。', file: 'assets2/bsd-g4x-040/0.mp3' },
      { t: 3.54, dur: 3.5, text: '其中的一份，就可以用分数表示。', file: 'assets2/bsd-g4x-040/1.mp3' },
      { t: 7.22, dur: 3.46, text: '分母五，表示平均分成了五份。', file: 'assets2/bsd-g4x-040/2.mp3' },
      { t: 10.86, dur: 3.67, text: '分子一，表示取了其中的一份。', file: 'assets2/bsd-g4x-040/3.mp3' },
      { t: 14.71, dur: 2.81, text: '这个分数就是五分之一。', file: 'assets2/bsd-g4x-040/4.mp3' },
    ]
  },
  'bsd-g4x-041': {
    total: 19.04,
    lines: [
      { t: 0, dur: 3.46, text: '把一个整体，平均分成七份。', file: 'assets2/bsd-g4x-041/0.mp3' },
      { t: 3.64, dur: 3.62, text: '其中的四份，就可以用分数表示。', file: 'assets2/bsd-g4x-041/1.mp3' },
      { t: 7.44, dur: 3.6, text: '分母七，表示平均分成了七份。', file: 'assets2/bsd-g4x-041/2.mp3' },
      { t: 11.22, dur: 3.84, text: '分子四，表示取了其中的四份。', file: 'assets2/bsd-g4x-041/3.mp3' },
      { t: 15.24, dur: 3, text: '这个分数就是七分之四。', file: 'assets2/bsd-g4x-041/4.mp3' },
    ]
  },
  'bsd-g4x-043': {
    total: 20.46,
    lines: [
      { t: 0, dur: 4.63, text: '比较这些数的大小：二、九、五、九。', file: 'assets1/bsd-g4x-043/0.mp3' },
      { t: 4.81, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g4x-043/1.mp3' },
      { t: 8.4, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g4x-043/2.mp3' },
      { t: 12.08, dur: 4.34, text: '从小到大排是：二、五、九、九。', file: 'assets1/bsd-g4x-043/3.mp3' },
      { t: 16.61, dur: 3.05, text: '最大的是九，最小的是二。', file: 'assets1/bsd-g4x-043/4.mp3' },
    ]
  },
  'bsd-g4x-044': {
    total: 20.5,
    lines: [
      { t: 0, dur: 4.58, text: '比较这些数的大小：一、三、一、六。', file: 'assets1/bsd-g4x-044/0.mp3' },
      { t: 4.76, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g4x-044/1.mp3' },
      { t: 8.35, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g4x-044/2.mp3' },
      { t: 12.04, dur: 4.39, text: '从小到大排是：一、一、三、六。', file: 'assets1/bsd-g4x-044/3.mp3' },
      { t: 16.61, dur: 3.1, text: '最大的是六，最小的是一。', file: 'assets1/bsd-g4x-044/4.mp3' },
    ]
  },
  'bsd-g5s-002': {
    total: 20.67,
    lines: [
      { t: 0, dur: 4.25, text: '比较这些数的大小：零点六、零点六。', file: 'assets1/bsd-g5s-002/0.mp3' },
      { t: 4.43, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g5s-002/1.mp3' },
      { t: 8.02, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g5s-002/2.mp3' },
      { t: 11.7, dur: 4.1, text: '从小到大排是：零点六、零点六。', file: 'assets1/bsd-g5s-002/3.mp3' },
      { t: 15.98, dur: 3.89, text: '最大的是零点六，最小的是零点六。', file: 'assets1/bsd-g5s-002/4.mp3' },
    ]
  },
  'bsd-g5s-003': {
    total: 18.18,
    lines: [
      { t: 0, dur: 2.86, text: '算三点四加二点五。', file: 'assets2/bsd-g5s-003/0.mp3' },
      { t: 3.04, dur: 3.86, text: '小数点先对齐，位数不够用零补。', file: 'assets2/bsd-g5s-003/1.mp3' },
      { t: 7.08, dur: 4.06, text: '按整数那样，从最低位加起或减起。', file: 'assets2/bsd-g5s-003/2.mp3' },
      { t: 11.32, dur: 3.62, text: '三点四加二点五，等于五点九。', file: 'assets2/bsd-g5s-003/3.mp3' },
      { t: 15.12, dur: 2.26, text: '结果是五点九个。', file: 'assets2/bsd-g5s-003/4.mp3' },
    ]
  },
  'bsd-g5s-004': {
    total: 20.96,
    lines: [
      { t: 0, dur: 4.32, text: '比较这些数的大小：五点六、五点五八。', file: 'assets1/bsd-g5s-004/0.mp3' },
      { t: 4.5, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets1/bsd-g5s-004/1.mp3' },
      { t: 8.09, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets1/bsd-g5s-004/2.mp3' },
      { t: 11.77, dur: 4.18, text: '从小到大排是：五点五八、五点六。', file: 'assets1/bsd-g5s-004/3.mp3' },
      { t: 16.13, dur: 4.03, text: '最大的是五点六，最小的是五点五八。', file: 'assets1/bsd-g5s-004/4.mp3' },
    ]
  },
  'bsd-g5s-005': {
    total: 18.44,
    lines: [
      { t: 0, dur: 2.9, text: '算八点五减三点七。', file: 'assets2/bsd-g5s-005/0.mp3' },
      { t: 3.08, dur: 3.86, text: '小数点先对齐，位数不够用零补。', file: 'assets2/bsd-g5s-005/1.mp3' },
      { t: 7.13, dur: 4.06, text: '按整数那样，从最低位加起或减起。', file: 'assets2/bsd-g5s-005/2.mp3' },
      { t: 11.36, dur: 3.79, text: '八点五减三点七，等于四点八。', file: 'assets2/bsd-g5s-005/3.mp3' },
      { t: 15.34, dur: 2.3, text: '结果是四点八个。', file: 'assets2/bsd-g5s-005/4.mp3' },
    ]
  },
  'bsd-g5s-007': {
    total: 18.37,
    lines: [
      { t: 0, dur: 2.69, text: '算九点五加九点七。', file: 'assets2/bsd-g5s-007/0.mp3' },
      { t: 2.87, dur: 3.86, text: '小数点先对齐，位数不够用零补。', file: 'assets2/bsd-g5s-007/1.mp3' },
      { t: 6.91, dur: 4.06, text: '按整数那样，从最低位加起或减起。', file: 'assets2/bsd-g5s-007/2.mp3' },
      { t: 11.15, dur: 3.77, text: '九点五加九点七，等于十九点二。', file: 'assets2/bsd-g5s-007/3.mp3' },
      { t: 15.1, dur: 2.47, text: '结果是十九点二个。', file: 'assets2/bsd-g5s-007/4.mp3' },
    ]
  },
  'bsd-g5s-046': {
    total: 18.27,
    lines: [
      { t: 0, dur: 3.48, text: '比较这些数的大小：二、二。', file: 'assets2/bsd-g5s-046/0.mp3' },
      { t: 3.66, dur: 3.41, text: '先看位数，位数多的数更大。', file: 'assets2/bsd-g5s-046/1.mp3' },
      { t: 7.25, dur: 3.5, text: '位数一样，就从高位一位一位比。', file: 'assets2/bsd-g5s-046/2.mp3' },
      { t: 10.93, dur: 3.31, text: '从小到大排是：二、二。', file: 'assets2/bsd-g5s-046/3.mp3' },
      { t: 14.42, dur: 3.05, text: '最大的是二，最小的是二。', file: 'assets2/bsd-g5s-046/4.mp3' },
    ]
  },
  'bsd-g5x-010': {
    total: 18.42,
    lines: [
      { t: 0, dur: 3.41, text: '把一个整体，平均分成八份。', file: 'assets2/bsd-g5x-010/0.mp3' },
      { t: 3.59, dur: 3.5, text: '其中的一份，就可以用分数表示。', file: 'assets2/bsd-g5x-010/1.mp3' },
      { t: 7.27, dur: 3.48, text: '分母八，表示平均分成了八份。', file: 'assets2/bsd-g5x-010/2.mp3' },
      { t: 10.93, dur: 3.67, text: '分子一，表示取了其中的一份。', file: 'assets2/bsd-g5x-010/3.mp3' },
      { t: 14.78, dur: 2.83, text: '这个分数就是八分之一。', file: 'assets2/bsd-g5x-010/4.mp3' },
    ]
  },
  'bsd-g5x-012': {
    total: 18.7,
    lines: [
      { t: 0, dur: 3.36, text: '把一个整体，平均分成五份。', file: 'assets2/bsd-g5x-012/0.mp3' },
      { t: 3.54, dur: 3.65, text: '其中的三份，就可以用分数表示。', file: 'assets2/bsd-g5x-012/1.mp3' },
      { t: 7.37, dur: 3.46, text: '分母五，表示平均分成了五份。', file: 'assets2/bsd-g5x-012/2.mp3' },
      { t: 11, dur: 3.82, text: '分子三，表示取了其中的三份。', file: 'assets2/bsd-g5x-012/3.mp3' },
      { t: 15, dur: 2.9, text: '这个分数就是五分之三。', file: 'assets2/bsd-g5x-012/4.mp3' },
    ]
  },
  'bsd-g6x-004': {
    total: 13.93,
    lines: [
      { t: 0, dur: 2.21, text: '每二个分成一组。', file: 'assets3/bsd-g6x-004/0.mp3' },
      { t: 2.39, dur: 2.69, text: '像这样，一共有一组。', file: 'assets3/bsd-g6x-004/1.mp3' },
      { t: 5.26, dur: 3.26, text: '求一共多少个，用乘法来算。', file: 'assets3/bsd-g6x-004/2.mp3' },
      { t: 8.7, dur: 2.35, text: '二乘一，等于二。', file: 'assets3/bsd-g6x-004/3.mp3' },
      { t: 11.23, dur: 1.9, text: '一共有二条。', file: 'assets3/bsd-g6x-004/4.mp3' },
    ]
  },
};

const NODE_SUBPKG = {
  'bsd-g1x-032': 'audio1',
  'bsd-g3x-036': 'audio1',
  'bsd-g2x-019': 'audio1',
  'bsd-g3s-029': 'audio1',
  'bsd-g4s-038': 'audio1',
  'bsd-g4x-007': 'audio1',
  'bsd-g5s-004': 'audio1',
  'bsd-g1x-025': 'audio1',
  'bsd-g5s-002': 'audio1',
  'bsd-g1x-024': 'audio1',
  'bsd-g1s-004': 'audio1',
  'bsd-g4s-041': 'audio1',
  'bsd-g4x-044': 'audio1',
  'bsd-g4x-043': 'audio1',
  'bsd-g4s-022': 'audio1',
  'bsd-g4x-033': 'audio1',
  'bsd-g1x-040': 'audio1',
  'bsd-g2s-008': 'audio2',
  'bsd-g4x-037': 'audio2',
  'bsd-g4x-041': 'audio2',
  'bsd-g4s-003': 'audio2',
  'bsd-g5x-012': 'audio2',
  'bsd-g4x-014': 'audio2',
  'bsd-g1s-006': 'audio2',
  'bsd-g5s-005': 'audio2',
  'bsd-g5x-010': 'audio2',
  'bsd-g2x-027': 'audio2',
  'bsd-g1s-002': 'audio2',
  'bsd-g5s-007': 'audio2',
  'bsd-g4x-040': 'audio2',
  'bsd-g5s-046': 'audio2',
  'bsd-g2x-038': 'audio2',
  'bsd-g3s-030': 'audio2',
  'bsd-g5s-003': 'audio2',
  'bsd-g2x-032': 'audio2',
  'bsd-g1x-033': 'audio2',
  'bsd-g1x-019': 'audio3',
  'bsd-g2s-026': 'audio3',
  'bsd-g1s-008': 'audio3',
  'bsd-g2s-024': 'audio3',
  'bsd-g2s-023': 'audio3',
  'bsd-g3s-023': 'audio3',
  'bsd-g4s-032': 'audio3',
  'bsd-g1s-013': 'audio3',
  'bsd-g1s-027': 'audio3',
  'bsd-g3x-013': 'audio3',
  'bsd-g4x-018': 'audio3',
  'bsd-g1s-001': 'audio3',
  'bsd-g3s-003': 'audio3',
  'bsd-g2s-013': 'audio3',
  'bsd-g2s-014': 'audio3',
  'bsd-g2s-015': 'audio3',
  'bsd-g2s-037': 'audio3',
  'bsd-g4x-039': 'audio3',
  'bsd-g6x-004': 'audio3',
  'bsd-g2s-006': 'audio3',
  'bsd-g1s-011': 'audio3',
  'bsd-g3s-019': 'audio3',
};

function narrationNodeOf(nodeId) { return NARRATION_NODES[nodeId] || null; }
function subpackageOf(nodeId) { return NODE_SUBPKG[nodeId] || null; }

module.exports = { NARRATION_NODES, NODE_SUBPKG, narrationNodeOf, subpackageOf };
