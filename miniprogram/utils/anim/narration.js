// utils/anim/narration.js —— 动画旁白时间轴
//
// ⚠️ 本文件由 tools/gen_narration.py 自动生成，不要手改。
//    改文案请改 tools/narration_src.json，然后重跑：
//    "D:/tool/software/python/python3.10.9/python.exe" tools/gen_narration.py
//
// t    这句开始的时间（秒），由前面各句实测音频时长累加得出
// dur  这句音频的真实时长（秒）
// file 相对 miniprogram/assets/audio/ 的路径
//
// 场景里的动画节点用 u.cue(i) 取第 i 句的开始时间，不要写死秒数——
// 写死的话改一句文案，画面就跟声音错开了。

const NARRATION = {
  addMeaning: {
    total: 15.03,
    lines: [
      { t: 0.0, dur: 2.23, text: '左边有三个红点。', file: 'addMeaning/0.mp3' },
      { t: 2.41, dur: 2.21, text: '右边有两个蓝点。', file: 'addMeaning/1.mp3' },
      { t: 4.8, dur: 3.36, text: '把两堆放到一起，就是合起来。', file: 'addMeaning/2.mp3' },
      { t: 8.34, dur: 2.54, text: '合起来，用加法算。', file: 'addMeaning/3.mp3' },
      { t: 11.06, dur: 3.17, text: '三加二等于五，一共有五个。', file: 'addMeaning/4.mp3' },
    ]
  },
  makeTen: {
    total: 21.32,
    lines: [
      { t: 0.0, dur: 4.22, text: '先看这个十格阵，里面已经放了九个圆点。', file: 'makeTen/0.mp3' },
      { t: 4.4, dur: 3.26, text: '还空着一格，差一个就满十了。', file: 'makeTen/1.mp3' },
      { t: 7.85, dur: 3.34, text: '从右边的五个里，拿一个放进去。', file: 'makeTen/2.mp3' },
      { t: 11.36, dur: 4.3, text: '十格满了。这十个，就是一个十。', file: 'makeTen/3.mp3' },
      { t: 15.84, dur: 4.68, text: '右边还剩四个。十加四，等于十四。', file: 'makeTen/4.mp3' },
    ]
  },
  perimeter: {
    total: 22.66,
    lines: [
      { t: 0.0, dur: 4.34, text: '这是一个长方形，长五厘米，宽三厘米。', file: 'perimeter/0.mp3' },
      { t: 4.52, dur: 3.84, text: '小球从角上出发，沿着边一直走。', file: 'perimeter/1.mp3' },
      { t: 8.54, dur: 3.62, text: '每走过一条边，就记下它的长度。', file: 'perimeter/2.mp3' },
      { t: 12.35, dur: 4.61, text: '四条边全走完，一共走了多少，就是周长。', file: 'perimeter/3.mp3' },
      { t: 17.14, dur: 4.73, text: '五加三，再加五，再加三，等于十六厘米。', file: 'perimeter/4.mp3' },
    ]
  },
  fractionAdd: {
    total: 23.41,
    lines: [
      { t: 0.0, dur: 3.12, text: '要算二分之一加三分之一。', file: 'fractionAdd/0.mp3' },
      { t: 3.3, dur: 3.74, text: '分母不一样，不能直接把分子相加。', file: 'fractionAdd/1.mp3' },
      { t: 7.22, dur: 5.11, text: '先都分成六份。二分之一，就是六分之三。', file: 'fractionAdd/2.mp3' },
      { t: 12.52, dur: 3.02, text: '三分之一，就是六分之二。', file: 'fractionAdd/3.mp3' },
      { t: 15.72, dur: 6.89, text: '分母一样了，分子相加。六分之三加六分之二，等于六分之五。', file: 'fractionAdd/4.mp3' },
    ]
  },
};

// 取第 i 句的开始时间；越界时退回场景总时长，避免 NaN 传进绘制
function cueOf(sceneId, i) {
  const s = NARRATION[sceneId];
  if (!s) return 0;
  const ln = s.lines[i];
  return ln ? ln.t : s.total;
}

function narrationOf(sceneId) {
  return NARRATION[sceneId] || null;
}

module.exports = { NARRATION, cueOf, narrationOf };
