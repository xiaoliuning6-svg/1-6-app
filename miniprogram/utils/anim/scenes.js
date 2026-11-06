// utils/anim/scenes.js —— 动画讲解场景库（参数化版）
//
// 设计原则：
//   1. 每个场景是一个纯绘制函数 draw(ctx, W, H, t, u, data) —— 给定时刻 t 秒，把当前帧画出来。
//      不读时钟、不存状态、不依赖 wx / DOM，所以小程序 canvas 2d 和浏览器 canvas 共用同一份代码。
//   2. 所有尺寸都按画布宽高比例算，不写死像素 —— 换设备、换尺寸都不变形。
//   3. 素材全是几何图形，不用图片 —— 一个场景几百字节，不占包体积。
//   4. **所有动作节点挂在 u.cue(i) 上，不写死秒数。**
//   5. **data 缺省时回退到内置演示例题**（向后兼容）；传入 data 时画真实题目的数字。
//
// data 约定（各场景只取自己需要的字段）：
//   addMeaning : { a, b, sum, unit? }            两个数合起来
//   makeTen    : { a, b }                         a 是接近十的数（7/8/9），b 为加数，演示凑十
//   perimeter  : { w, h, unit }                  长方形周长
//   fractionAdd: { a, b, c, d }                   a/b + c/d（异分母分数相加）

const P = Math.PI;

/* 小工具：画一条从 a 到 b 的部分线段（k∈[0,1] 表示已画比例） */
function partialLine(ctx, x1, y1, x2, y2, k) {
  if (k <= 0) return;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k);
  ctx.stroke();
}

/* 二次贝塞尔取点，用于「飞过去」的移动 */
function qbez(p0, p1, p2, k) {
  const m = 1 - k;
  return {
    x: m * m * p0.x + 2 * m * k * p1.x + k * k * p2.x,
    y: m * m * p0.y + 2 * m * k * p1.y + k * k * p2.y
  };
}

/* 淡入：p 从 0 到 1 时 alpha 跟着走，避免元素硬生生蹦出来 */
const fade = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p);

const SCENES = {
  /* ================= 1. 加法的意义：两组东西合起来 ================= */
  addMeaning: {
    title: '一共有多少——加法的意义',
    duration: 15,
    draw(ctx, W, H, t, u, data) {
      const a = (data && data.a != null) ? data.a : 3;
      const b = (data && data.b != null) ? data.b : 2;
      const sum = (data && data.sum != null) ? data.sum : a + b;
      const unit = (data && data.unit) || '个';
      const cue = u.cue;
      const total = a + b;
      // 圆点半径按总数自适应：总数多就小一点，别挤成一团
      const r = Math.min(W * 0.05, H * 0.085, W / (total * 2.6));
      const gap = r * 2.5;
      const cy = H * 0.42;
      const L0 = W * 0.15;          // 左组第 1 个点的圆心
      const R0 = W * 0.58;          // 右组第 1 个点的圆心（合拢前）
      const plusGap = r * 1.4;      // 合拢后两组之间专门给「+」留的缝，不留就压到圆点

      // 顶部常驻题面
      const fsQ = Math.min(H * 0.09, W * 0.055);
      u.label(ctx, `${a} + ${b} = ?`, W / 2, H * 0.13, { size: fsQ, color: u.C.text, bold: true });

      // 合拢目标：右组第 1 点落在「左组最后一点 + 一个 gap + 加号宽度」处。
      const R_TARGET = L0 + total * gap + plusGap;
      const span = (R_TARGET + gap) - L0;   // 全部圆心的总跨度
      const dx = (W - span) / 2 - L0;       // 整组水平居中
      const L = L0 + dx;
      const R = R0 + dx;

      // 第 2 句「把两堆放到一起」时合拢
      const t2 = cue(2);
      const join = u.easeInOut(u.seg(t, t2 + 0.3, t2 + 2.4));
      const shift = (R_TARGET - R0) * join;

      // 第 1 句「左边有 a 个红点」：红点逐个弹出
      const t0 = cue(0);
      for (let i = 0; i < a; i++) {
        const p = u.easeOut(u.seg(t, t0 + 0.35 + i * 0.45, t0 + 0.95 + i * 0.45));
        if (p > 0) u.dot(ctx, L + i * gap, cy, r * p, u.C.red);
      }
      // 第 2 句「右边有 b 个蓝点」
      const t1 = cue(1);
      for (let i = 0; i < b; i++) {
        const p = u.easeOut(u.seg(t, t1 + 0.35 + i * 0.55, t1 + 0.95 + i * 0.55));
        if (p > 0) u.dot(ctx, R + i * gap + shift, cy, r * p, u.C.blue);
      }

      // 第 4 句「合起来用加法算」：加号落在两组之间预留的缝里
      const t3 = cue(3);
      const pa = u.easeOut(u.seg(t, t3 + 0.15, t3 + 0.85));
      if (pa > 0) {
        ctx.globalAlpha = pa;
        const midX = (L + (a - 1) * gap + (R + shift)) / 2;
        u.label(ctx, '+', midX, cy, { size: r * 1.3, color: u.C.sub, bold: true });
        ctx.globalAlpha = 1;
      }

      // 第 5 句「a 加 b 等于 sum」：算式逐字浮现，数字用对应颜色，学生一眼对上点
      const items = [
        [String(a), u.C.red], ['+', u.C.sub], [String(b), u.C.blue],
        ['=', u.C.sub], [String(sum), u.C.green]
      ];
      const fs = Math.min(H * 0.15, W * 0.095);
      const step = fs * 0.82;
      const t4 = cue(4);
      let x = W / 2 - (items.length * step) / 2 + step / 2;
      items.forEach(([ch, col], i) => {
        const p = u.easeOut(u.seg(t, t4 + 0.4 + i * 0.42, t4 + 0.85 + i * 0.42));
        if (p > 0) {
          ctx.globalAlpha = p;
          u.label(ctx, ch, x, H * 0.80 - (1 - p) * fs * 0.25, { size: fs, color: col, bold: true });
          ctx.globalAlpha = 1;
        }
        x += step;
      });
    }
  },

  /* ================= 2. 凑十法：a + b = a + (10-a) + (b-(10-a)) ================= */
  makeTen: {
    title: '凑十法',
    duration: 21,
    draw(ctx, W, H, t, u, data) {
      const a = (data && data.a != null) ? data.a : 9;   // 接近十的数
      const b = (data && data.b != null) ? data.b : 5;   // 加数
      const tenPart = 10 - a;            // 从 b 里拿多少凑满十
      const rest = b - tenPart;          // 剩下的
      const result = a + b;
      const cue = u.cue;
      const cols = 5;
      const rows = 2;
      const s = Math.min((W * 0.42) / cols, (H * 0.32) / rows); // 十格阵每格边长
      const x0 = W * 0.07;
      const y0 = H * 0.26;
      const dr = s * 0.29;

      // 顶部常驻题面
      u.label(ctx, `${a} + ${b} = ?`, W / 2, H * 0.11, {
        size: Math.min(H * 0.09, W * 0.055),
        color: u.C.text,
        bold: true
      });
      const cell = (i) => ({
        x: x0 + (i % cols) * s + s / 2,
        y: y0 + Math.floor(i / cols) * s + s / 2
      });

      // 十格阵：一张整表 + 内部网格线
      ctx.strokeStyle = u.C.line;
      ctx.lineWidth = 1.5;
      u.roundRect(ctx, x0, y0, cols * s, rows * s, s * 0.14);
      ctx.stroke();
      for (let i = 1; i < cols; i++) {
        ctx.beginPath();
        ctx.moveTo(x0 + i * s, y0);
        ctx.lineTo(x0 + i * s, y0 + rows * s);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(x0, y0 + s);
      ctx.lineTo(x0 + cols * s, y0 + s);
      ctx.stroke();

      // 第 1 句：先摆 a 个红点（前 a 格）
      const t0 = cue(0);
      for (let i = 0; i < a; i++) {
        const p = u.easeOut(u.seg(t, t0 + 0.6 + i * 0.31, t0 + 1.0 + i * 0.31));
        if (p > 0) {
          const c = cell(i);
          u.dot(ctx, c.x, c.y, dr * p, u.C.red);
        }
      }

      // 第 2 句「还空着一格」：把第 a 格（空的）轻轻呼吸一下
      const t1 = cue(1);
      const breathe = u.seg(t, t1 + 0.2, t1 + 1.0) * (1 - u.seg(t, t1 + 2.6, t1 + 3.0));
      if (breathe > 0) {
        const empty = cell(a);
        ctx.save();
        ctx.globalAlpha = 0.35 * breathe;
        ctx.fillStyle = u.C.greenSoft;
        ctx.fillRect(empty.x - s / 2 + 1.5, empty.y - s / 2 + 1.5, s - 3, s - 3);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = breathe;
        ctx.strokeStyle = u.C.green;
        ctx.lineWidth = 2;
        ctx.strokeRect(empty.x - s / 2 + 1.5, empty.y - s / 2 + 1.5, s - 3, s - 3);
        ctx.restore();
      }

      // 第 3 句「从右边的 b 个里，拿一个放进去」
      const t2 = cue(2);
      const rx = W * 0.66;
      const ry = y0 + s * 0.78;
      const rGap = s * 0.6;
      const fly = u.easeInOut(u.seg(t, t2 + 1.5, t2 + 3.0));
      for (let i = 0; i < b; i++) {
        const p = u.easeOut(u.seg(t, t2 + 0.1 + i * 0.16, t2 + 0.45 + i * 0.16));
        if (p > 0) {
          const alpha = i === 0 ? 1 - u.seg(t, t2 + 1.4, t2 + 1.8) : 1;
          if (alpha > 0) u.dot(ctx, rx + i * rGap, ry, dr * p, u.C.blue, alpha);
        }
      }

      // 补进十格阵第 a 格（凑满十）
      if (fly > 0) {
        const from = { x: rx, y: ry };
        const to = cell(a);
        const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - s * 1.2 };
        const pos = qbez(from, ctrl, to, fly);
        u.dot(ctx, pos.x, pos.y, dr, fly >= 1 ? u.C.green : u.C.blue);
      }

      // 第 4 句「十格满了」：绿框闪一下
      const t3 = cue(3);
      const flash = u.seg(t, t3 + 0.15, t3 + 0.6) * (1 - u.seg(t, t3 + 3.4, t3 + 3.9));
      if (flash > 0) {
        ctx.globalAlpha = flash;
        ctx.strokeStyle = u.C.green;
        ctx.lineWidth = 4;
        u.roundRect(ctx, x0 - 3, y0 - 3, cols * s + 6, rows * s + 6, s * 0.2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 算式两条：a+(10-a)=10 在「这十个，就是一个十」时出；10+rest=result 在最后一句后半出
      const fs = Math.min(H * 0.11, W * 0.062);
      const y1 = H * 0.76;
      const y2 = H * 0.9;
      const a1 = u.easeOut(u.seg(t, t3 + 2.0, t3 + 2.6));
      if (a1 > 0) {
        ctx.globalAlpha = a1;
        u.label(ctx, `${a} + ${tenPart} = 10`, W * 0.5, y1, { size: fs, color: u.C.green, bold: true });
        ctx.globalAlpha = 1;
      }
      const t4 = cue(4);
      const a2 = u.easeOut(u.seg(t, t4 + 2.0, t4 + 2.6));
      if (a2 > 0) {
        ctx.globalAlpha = a2;
        u.label(ctx, `10 + ${rest} = ${result}`, W * 0.5, y2, { size: fs, color: u.C.text, bold: true });
        ctx.globalAlpha = 1;
      }
    }
  },

  /* ================= 3. 周长：沿边绕一整圈 ================= */
  perimeter: {
    title: '什么是周长',
    duration: 23,
    draw(ctx, W, H, t, u, data) {
      const w = (data && data.w != null) ? data.w : 5;
      const h = (data && data.h != null) ? data.h : 3;
      const unit = (data && data.unit) || '厘米';
      const cue = u.cue;
      // 长方形保持 5:3 的观感（演示态），真实数据按比例缩放
      const demoRatio = 0.6;
      const ratio = (data && data.w != null) ? (h / w) : demoRatio;
      const bw = W * 0.54;
      const bh = bw * (data && data.w != null ? ratio : demoRatio);
      const x0 = (W - bw) / 2;
      const y0 = H * 0.24;

      // 第 1 句：长方形出现（虚线底框）
      const show = u.easeOut(u.seg(t, cue(0) + 0.2, cue(0) + 1.0));
      ctx.save();
      ctx.globalAlpha = show;
      ctx.strokeStyle = u.C.line;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      ctx.strokeRect(x0, y0, bw, bh);
      ctx.restore();

      // 四条边：上 w、右 h、下 w、左 h
      const edges = [
        { x1: x0, y1: y0, x2: x0 + bw, y2: y0, len: w, side: 'top' },
        { x1: x0 + bw, y1: y0, x2: x0 + bw, y2: y0 + bh, len: h, side: 'right' },
        { x1: x0 + bw, y1: y0 + bh, x2: x0, y2: y0 + bh, len: w, side: 'bottom' },
        { x1: x0, y1: y0 + bh, x2: x0, y2: y0, len: h, side: 'left' }
      ];
      const TOTAL = 2 * (w + h);

      // 第 2 句「小球从角上出发」开始走，第 4 句「四条边全走完」时刚好停
      const t1 = cue(1);
      const t3 = cue(3);
      const walked = u.seg(t, t1 + 0.5, t3 + 1.6) * TOTAL;
      let acc = 0;
      let head = null;

      ctx.strokeStyle = u.C.green;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      edges.forEach((e) => {
        const done = Math.min(Math.max(walked - acc, 0), e.len);
        if (done > 0) {
          const k = done / e.len;
          partialLine(ctx, e.x1, e.y1, e.x2, e.y2, k);
          if (done < e.len) {
            head = { x: e.x1 + (e.x2 - e.x1) * k, y: e.y1 + (e.y2 - e.y1) * k };
          }
        }
        acc += e.len;
      });

      // 走着的那个小球
      if (head && show > 0.6) {
        u.dot(ctx, head.x, head.y, Math.min(W, H) * 0.028, '#ffffff', 1);
        ctx.strokeStyle = u.C.green;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(head.x, head.y, Math.min(W, H) * 0.028, 0, P * 2);
        ctx.stroke();
      }

      // 第 5 句收尾算式会顶在下边标注的位置上，所以最后让下边标注淡出
      const t4 = cue(4);
      const fin = u.easeOut(u.seg(t, t4 + 0.5, t4 + 1.4));

      // 各边标注数值，跟着第 1 句依次亮出来
      const fsSide = Math.min(H * 0.085, W * 0.048);
      const mark = (txt, x, y, alpha) => {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff';
        const tw = fsSide * 1.4;
        ctx.fillRect(x - tw / 2, y - fsSide * 0.85, tw, fsSide * 1.7);
        u.label(ctx, txt, x, y, { size: fsSide, color: u.C.sub });
        ctx.restore();
      };
      const m0 = cue(0);
      const seq = (i) => u.easeOut(u.seg(t, m0 + 1.6 + i * 0.45, m0 + 2.1 + i * 0.45));
      mark(String(w), x0 + bw / 2, y0 - fsSide * 1.15, seq(0));
      mark(String(h), x0 + bw + fsSide * 1.15, y0 + bh / 2, seq(1));
      mark(String(w), x0 + bw / 2, y0 + bh + fsSide * 1.15, seq(2) * (1 - fin));
      mark(String(h), x0 - fsSide * 1.15, y0 + bh / 2, seq(3));

      // 实时累计：放在长方形内部空白处
      const fs = Math.min(H * 0.11, W * 0.06);
      const shown = Math.min(Math.round(walked), TOTAL);
      if (walked > 0 && fin < 1) {
        ctx.globalAlpha = 1 - fin;
        u.label(ctx, `已走 ${shown} ${unit}`, x0 + bw / 2, y0 + bh / 2, {
          size: fs,
          color: u.C.green,
          bold: true
        });
        ctx.globalAlpha = 1;
      }

      // 收尾算式
      if (fin > 0) {
        ctx.globalAlpha = fin;
        u.label(ctx, `周长 = ${w}+${h}+${w}+${h} = ${TOTAL} ${unit}`, W / 2, H * 0.93, {
          size: Math.min(H * 0.1, W * 0.055),
          color: u.C.green,
          bold: true
        });
        ctx.globalAlpha = 1;
      }
    }
  },

  /* ================= 4. 异分母分数相加：分数条折纸 a/b + c/d ================= */
  fractionAdd: {
    title: '折纸——异分母分数加减',
    duration: 23,
    draw(ctx, W, H, t, u, data) {
      const a = (data && data.a != null) ? data.a : 1;
      const b = (data && data.b != null) ? data.b : 2;
      const c = (data && data.c != null) ? data.c : 1;
      const d = (data && data.d != null) ? data.d : 3;
      const cue = u.cue;
      // 通分：common 为 b、d 的最小公倍数
      const g = (x, y) => { while (y) { [x, y] = [y, x % y]; } return x; };
      const common = (b * d) / g(b, d);
      const fa = a * (common / b);   // 第一个分数在 common 等分里占几格
      const fc = c * (common / d);   // 第二个分数在 common 等分里占几格
      const result = fa + fc;

      const x0 = W * 0.1;
      const bw = W * 0.8;
      const n = common; // 通分成 common 份
      const cellW = bw / n;
      const barH = H * 0.09;

      const bar = (y, fills, alpha) => {
        const al = alpha == null ? 1 : alpha;
        if (al <= 0) return;
        ctx.save();
        ctx.globalAlpha = al;
        fills.forEach((f) => {
          if (f.p <= 0) return;
          const w = Math.max(cellW * f.span * f.p - 3, 0);
          ctx.fillStyle = f.color;
          ctx.fillRect(x0 + f.from * cellW + 1.5, y + 1.5, w, barH - 3);
        });
        ctx.strokeStyle = u.C.line;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0, y, bw, barH);
        for (let i = 1; i < n; i++) {
          ctx.beginPath();
          ctx.moveTo(x0 + i * cellW, y);
          ctx.lineTo(x0 + i * cellW, y + barH);
          ctx.stroke();
        }
        ctx.restore();
      };

      const y1 = H * 0.28;
      const y2 = H * 0.52;
      const y3 = H * 0.76;
      const fsTop = Math.min(H * 0.095, W * 0.056);
      const fs = Math.min(H * 0.075, W * 0.045);

      // 顶部题面常驻
      u.label(ctx, `${a}/${b} + ${c}/${d} = ?`, W / 2, H * 0.09, {
        size: fsTop,
        color: u.C.text,
        bold: true
      });

      // 第 1 句：两条空条先摆出来
      const t0 = cue(0);
      const show1 = fade(u.seg(t, t0 + 0.3, t0 + 0.9));
      bar(y1, [], show1);
      bar(y2, [], show1);

      // 第 5 句「分母一样了，分子相加」：合并到第三根条
      const t4 = cue(4);
      const merge = u.seg(t, t4 + 1.0, t4 + 3.0);

      // 第三根条在合并之前用浅虚线占位
      if (merge <= 0) {
        ctx.save();
        ctx.globalAlpha = show1 * 0.35;
        ctx.setLineDash([6, 6]);
        bar(y3, [], 1);
        ctx.restore();
      }

      // 第 2 句「分母不一样，不能直接相加」
      const t1 = cue(1);
      const warn = fade(u.seg(t, t1 + 0.2, t1 + 0.8)) * (1 - fade(u.seg(t, cue(2), cue(2) + 0.6)));
      if (warn > 0) {
        ctx.globalAlpha = warn;
        u.label(ctx, '分母不同，先通分', W / 2, H * 0.94, {
          size: Math.min(H * 0.085, W * 0.05),
          color: u.C.red,
          bold: true
        });
        ctx.globalAlpha = 1;
      }

      // 第 3 句：第一根条涂 fa 格（a/b）
      const t2 = cue(2);
      const p1 = u.seg(t, t2 + 1.4, t2 + 2.6);
      bar(y1, [{ from: 0, span: fa, color: u.C.green, p: p1 }], 1);
      const lab = (txt, y, color) =>
        u.label(ctx, txt, x0, y - fs * 0.9, { size: fs, color, align: 'left' });
      if (p1 > 0.15) lab(`${a}/${b} = ${fa}/${common}`, y1, u.C.green);

      // 第 4 句：第二根条涂 fc 格（c/d）
      const t3 = cue(3);
      const p2 = u.seg(t, t3 + 0.6, t3 + 1.8);
      bar(y2, [{ from: 0, span: fc, color: u.C.blue, p: p2 }], 1);
      if (p2 > 0.15) lab(`${c}/${d} = ${fc}/${common}`, y2, u.C.blue);

      // 合并：前 fa 格绿 + 后 fc 格蓝 = result 格
      if (merge > 0) {
        bar(y3, [
          { from: 0, span: fa, color: u.C.green, p: Math.min(merge * 2, 1) },
          { from: fa, span: fc, color: u.C.blue, p: Math.max(merge * 2 - 1, 0) }
        ], 1);
        if (merge > 0.4) lab(`${result}/${common}`, y3, u.C.text);
      }

      // 底部算式
      const fin = u.easeOut(u.seg(t, t4 + 3.6, t4 + 4.6));
      if (fin > 0) {
        ctx.globalAlpha = fin;
        u.label(ctx, `${a}/${b} + ${c}/${d} = ${fa}/${common} + ${fc}/${common} = ${result}/${common}`, W / 2, H * 0.94, {
          size: Math.min(H * 0.075, W * 0.044),
          color: u.C.text,
          bold: true
        });
        ctx.globalAlpha = 1;
      }
    }
  },


  /* ================= 5. 乘法：几个几 ================= */
  multiplyGroups: {
    title: '几个几——乘法的意义',
    duration: 18,
    draw(ctx, W, H, t, u, data) {
      const each = (data && data.each != null) ? data.each : 3;
      const groups = (data && data.groups != null) ? data.groups : 4;
      const unit = (data && data.unit) || '个';
      const cue = u.cue;
      // 按「列」布局：每组一列，列内 each 个点竖排，列间用「×」连接。
      // 先按画布宽高反推点半径，保证 groups 列一定落在画布内——
      // 旧版把每组横排 each 个点，组数一多就整排冲出画布（手机 343 宽必然越界）。
      const dotR = Math.min(
        H * 0.045,
        W * 0.9 / (groups * 2.6),           // 横向：groups 列全部装得下
        H * 0.46 / Math.max(each, 1) / 2.4  // 纵向：each 个点全部装得下
      );
      const colW = dotR * 2.6;
      const rowGap = dotR * 2.4;
      const totalW = groups * colW;
      const startX = (W - totalW) / 2 + colW / 2;
      const startY = H * 0.22;
      const midY = startY + (each - 1) * rowGap / 2;

      u.label(ctx, `${each} × ${groups} = ?`, W / 2, H * 0.10, { size: Math.min(H * 0.09, W * 0.06), color: u.C.text, bold: true });

      const t0 = cue(0), t1 = cue(1), t2 = cue(2);
      for (let g = 0; g < groups; g++) {
        const cx = startX + g * colW;
        // 第 0 句先出第一组；第 1 句补齐其余组
        const start = (g === 0) ? t0 : t1;
        for (let i = 0; i < each; i++) {
          const p = u.easeOut(u.seg(t, start + 0.2 + i * 0.18, start + 0.7 + i * 0.18));
          if (p > 0) u.dot(ctx, cx, startY + i * rowGap, dotR * p, u.C.red);
        }
        // 组与组之间的「×」在第三句出现（放在两列纵向中点）
        if (g < groups - 1) {
          const px = u.easeOut(u.seg(t, t2 + 0.1 + g * 0.2, t2 + 0.5 + g * 0.2));
          if (px > 0) u.label(ctx, '×', cx + colW / 2, midY, { size: dotR * 1.4, color: u.C.sub, alpha: px });
        }
      }
      // 第 4 句出算式
      const items = [String(each), '×', String(groups), '=', String(each * groups)];
      const fs = Math.min(H * 0.13, W * 0.08);
      const step = fs * 0.82;
      const t4 = cue(4);
      let x = W / 2 - (items.length * step) / 2 + step / 2;
      const cols = [u.C.red, u.C.sub, u.C.red, u.C.sub, u.C.green];
      items.forEach((ch, i) => {
        const p = u.easeOut(u.seg(t, t4 + 0.3 + i * 0.35, t4 + 0.75 + i * 0.35));
        if (p > 0) u.label(ctx, ch, x, H * 0.82 - (1 - p) * fs * 0.2, { size: fs, color: cols[i], bold: true });
        x += step;
      });
    }
  },

  /* ================= 6. 减法：拿走 ================= */
  subtractTake: {
    title: '拿走——减法的意义',
    duration: 18,
    draw(ctx, W, H, t, u, data) {
      const a = (data && data.a != null) ? data.a : 9;
      const b = (data && data.b != null) ? data.b : 4;
      const diff = (data && data.diff != null) ? data.diff : a - b;
      const unit = (data && data.unit) || '个';
      const cue = u.cue;
      const total = a;
      const r = Math.min(W * 0.04, H * 0.06, W / (total * 2.4));
      const gap = r * 2.4;
      const span = total * gap;
      const x0 = (W - span) / 2 + gap / 2;
      const cy = H * 0.42;

      u.label(ctx, `${a} - ${b} = ?`, W / 2, H * 0.13, { size: Math.min(H * 0.09, W * 0.06), color: u.C.text, bold: true });

      const t0 = cue(0), t1 = cue(1), t3 = cue(3), t4 = cue(4);
      for (let i = 0; i < total; i++) {
        const p0 = u.easeOut(u.seg(t, t0 + 0.2 + i * 0.12, t0 + 0.6 + i * 0.12));
        // 第 1 句：后 b 个飞走（向上淡出）
        let alpha = 1, dy = 0;
        if (i >= total - b) {
          const fly = u.easeInOut(u.seg(t, t1 + 0.3 + (i - (total - b)) * 0.18, t1 + 1.4 + (i - (total - b)) * 0.18));
          alpha = 1 - fly;
          dy = -fly * H * 0.22;
        }
        if (p0 > 0 && alpha > 0.02) u.dot(ctx, x0 + i * gap, cy + dy, r * p0, u.C.red, alpha);
      }
      // 第 2 句说明：画一个减号表示去掉
      const t2 = cue(2);
      const minusShow = u.seg(t, t2 + 0.2, t2 + 0.9) * (1 - u.seg(t, t2 + 2.4, t2 + 2.9));
      if (minusShow > 0) {
        ctx.save(); ctx.globalAlpha = minusShow;
        u.label(ctx, '去掉 ' + b, W / 2, H * 0.60, { size: Math.min(H * 0.07, W * 0.05), color: u.C.sub });
        ctx.restore();
      }
      // 算式
      const items = [String(a), '-', String(b), '=', String(diff)];
      const fs = Math.min(H * 0.13, W * 0.08);
      const step = fs * 0.82;
      let x = W / 2 - (items.length * step) / 2 + step / 2;
      const cols = [u.C.red, u.C.sub, u.C.red, u.C.sub, u.C.green];
      items.forEach((ch, i) => {
        const p = u.easeOut(u.seg(t, t3 + 0.3 + i * 0.3, t3 + 0.75 + i * 0.3));
        if (p > 0) u.label(ctx, ch, x, H * 0.82 - (1 - p) * fs * 0.2, { size: fs, color: cols[i], bold: true });
        x += step;
      });
      const remainY = H * 0.82 + fs * 0.9;
      if (t4 > 0) {
        const p = u.easeOut(u.seg(t, t4 + 0.2, t4 + 0.8));
        if (p > 0) u.label(ctx, `还剩 ${diff} ${unit}`, W / 2, remainY, { size: Math.min(H * 0.07, W * 0.05), color: u.C.green, alpha: p });
      }
    }
  },

  /* ================= 7. 减法：比多少 ================= */
  subtractCompare: {
    title: '比多少——相差多少',
    duration: 19,
    draw(ctx, W, H, t, u, data) {
      const a = (data && data.a != null) ? data.a : 15;
      const b = (data && data.b != null) ? data.b : 8;
      const diff = (data && data.diff != null) ? data.diff : Math.abs(a - b);
      const unit = (data && data.unit) || '个';
      const cue = u.cue;
      const n = Math.max(a, b);
      const r = Math.min(W * 0.035, H * 0.05, W / (n * 2.4));
      const gap = r * 2.4;
      const topY = H * 0.30, botY = H * 0.56;
      const x0 = (W - n * gap) / 2 + gap / 2;

      u.label(ctx, `甲 ${a} 个，乙 ${b} 个`, W / 2, H * 0.12, { size: Math.min(H * 0.08, W * 0.055), color: u.C.text, bold: true });

      const t0 = cue(0), t1 = cue(1), t2 = cue(2), t3 = cue(3);
      for (let i = 0; i < a; i++) {
        const p = u.easeOut(u.seg(t, t0 + 0.2 + i * 0.08, t0 + 0.5 + i * 0.08));
        if (p > 0) u.dot(ctx, x0 + i * gap, topY, r * p, u.C.red);
      }
      for (let i = 0; i < b; i++) {
        const p = u.easeOut(u.seg(t, t1 + 0.2 + i * 0.1, t1 + 0.5 + i * 0.1));
        if (p > 0) u.dot(ctx, x0 + i * gap, botY, r * p, u.C.blue);
      }
      // 第 2 句：高亮多出来的那一段（红色超出蓝色的部分）
      if (a > b) {
        const hl = u.seg(t, t2 + 0.3, t2 + 1.2);
        for (let i = b; i < a; i++) {
          ctx.save(); ctx.globalAlpha = 0.4 * hl;
          ctx.strokeStyle = u.C.green; ctx.lineWidth = 3;
          ctx.strokeRect(x0 + i * gap - r, topY - r, r * 2, r * 2);
          ctx.restore();
        }
      } else if (b > a) {
        const hl = u.seg(t, t2 + 0.3, t2 + 1.2);
        for (let i = a; i < b; i++) {
          ctx.save(); ctx.globalAlpha = 0.4 * hl;
          ctx.strokeStyle = u.C.green; ctx.lineWidth = 3;
          ctx.strokeRect(x0 + i * gap - r, botY - r, r * 2, r * 2);
          ctx.restore();
        }
      }
      const items = [String(Math.max(a, b)), '-', String(Math.min(a, b)), '=', String(diff)];
      const fs = Math.min(H * 0.13, W * 0.08);
      const step = fs * 0.82;
      let x = W / 2 - (items.length * step) / 2 + step / 2;
      const cols = [u.C.red, u.C.sub, u.C.blue, u.C.sub, u.C.green];
      items.forEach((ch, i) => {
        const p = u.easeOut(u.seg(t, t3 + 0.3 + i * 0.3, t3 + 0.75 + i * 0.3));
        if (p > 0) u.label(ctx, ch, x, H * 0.80 - (1 - p) * fs * 0.2, { size: fs, color: cols[i], bold: true });
        x += step;
      });
      const t4 = cue(4);
      const p4 = u.easeOut(u.seg(t, t4 + 0.2, t4 + 0.8));
      if (p4 > 0) u.label(ctx, `相差 ${diff} ${unit}`, W / 2, H * 0.92, { size: Math.min(H * 0.07, W * 0.05), color: u.C.green, alpha: p4 });
    }
  },

  /* ================= 8. 比较大小：排序 ================= */
  compareNumbers: {
    title: '比大小——排序',
    duration: 19,
    draw(ctx, W, H, t, u, data) {
      const nums = (data && data.nums && data.nums.length) ? data.nums : [3, 1, 5, 2];
      const cue = u.cue;
      const n = nums.length;
      const cardW = Math.min(W * 0.16, H * 0.2);
      const cardH = cardW * 1.3;
      const gap = cardW * 0.35;
      const span = n * cardW + (n - 1) * gap;
      const x0 = (W - span) / 2;
      const yMid = H * 0.38;

      u.label(ctx, '比一比，排一排', W / 2, H * 0.12, { size: Math.min(H * 0.08, W * 0.055), color: u.C.text, bold: true });

      const asc = nums.slice().sort((x, y) => x - y);
      const t0 = cue(0), t1 = cue(1), t3 = cue(3), t4 = cue(4);
      for (let i = 0; i < n; i++) {
        // 起始位置（乱序）与结束位置（升序）之间插值
        const fromX = x0 + i * (cardW + gap);
        const toIdx = asc.indexOf(nums[i]);
        const toX = x0 + toIdx * (cardW + gap);
        const move = u.easeInOut(u.seg(t, t1 + 0.3 + i * 0.15, t1 + 1.6 + i * 0.15));
        const x = fromX + (toX - fromX) * move;
        const appear = u.easeOut(u.seg(t, t0 + 0.2 + i * 0.2, t0 + 0.7 + i * 0.2));
        if (appear > 0) {
          ctx.save(); ctx.globalAlpha = appear;
          ctx.fillStyle = u.C.blueSoft; ctx.strokeStyle = u.C.blue; ctx.lineWidth = 2;
          u.roundRect(ctx, x, yMid - cardH / 2, cardW, cardH, 8); ctx.fill(); ctx.stroke();
          u.label(ctx, String(nums[i]), x + cardW / 2, yMid, { size: cardW * 0.5, color: u.C.blue, bold: true });
          ctx.restore();
        }
      }
      // 第 2 句：比位数/高位
      const t2 = cue(2);
      const tip = u.seg(t, t2 + 0.2, t2 + 0.9) * (1 - u.seg(t, t2 + 2.4, t2 + 2.9));
      if (tip > 0) u.label(ctx, '位数多的更大，高位先比', W / 2, H * 0.64, { size: Math.min(H * 0.06, W * 0.045), color: u.C.sub, alpha: tip });
      // 第 4 句标注最大最小
      if (t4 > 0) {
        const p = u.easeOut(u.seg(t, t4 + 0.2, t4 + 0.9));
        if (p > 0) u.label(ctx, `最大 ${asc[n - 1]} · 最小 ${asc[0]}`, W / 2, H * 0.80, { size: Math.min(H * 0.07, W * 0.05), color: u.C.green, bold: true, alpha: p });
      }
    }
  },

  /* ================= 9. 小数加减：小数点对齐 ================= */
  decimalAdd: {
    title: '小数点对齐——小数加减',
    duration: 19,
    draw(ctx, W, H, t, u, data) {
      const a = (data && data.a != null) ? data.a : 3.4;
      const b = (data && data.b != null) ? data.b : 2.5;
      const op = (data && data.op === 'sub') ? '-' : '+';
      const result = (data && data.result != null) ? data.result : (op === '-' ? a - b : a + b);
      const unit = (data && data.unit) || '个';
      const cue = u.cue;
      const fs = Math.min(H * 0.14, W * 0.09);
      const x = W * 0.32;
      const y0 = H * 0.30, dy = fs * 1.5;
      const decA = (a % 1 !== 0), decB = (b % 1 !== 0);
      const align = (v, dec) => {
        const s = String(v);
        if (!dec) return s + '.0';
        return s;
      };
      u.label(ctx, `${a} ${op} ${b} = ?`, W / 2, H * 0.12, { size: Math.min(H * 0.08, W*0.055), color: u.C.text, bold: true });
      const t0 = cue(0), t1 = cue(1), t2 = cue(2), t3 = cue(3);
      const lines = [
        { txt: align(a, decA), t: t0, col: u.C.red },
        { txt: op + ' ' + align(b, decB), t: t1, col: u.C.blue },
        { txt: '————', t: t2, col: u.C.sub },
        { txt: String(result), t: t3, col: u.C.green }
      ];
      let y = y0;
      lines.forEach((ln, i) => {
        const p = u.easeOut(u.seg(t, ln.t + 0.2 + i * 0.15, ln.t + 0.6 + i * 0.15));
        if (p > 0) {
          ctx.textAlign = 'left';
          u.label(ctx, ln.txt, x, y, { size: fs, color: ln.col, bold: i === 3, align: 'left' });
          ctx.textAlign = 'center';
        }
        y += dy;
      });
      // 小数点对齐提示线
      if (decA || decB) {
        const dp = u.seg(t, t1 + 0.2, t1 + 1.0);
        const ax = x + (String(a).split('.')[0].length) * fs * 0.55;
        if (dp > 0) {
          ctx.save(); ctx.globalAlpha = 0.5 * dp; ctx.strokeStyle = u.C.amber; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(ax, y0 - fs * 0.5); ctx.lineTo(ax, y0 + dy * 1.5); ctx.stroke();
          ctx.restore();
        }
      }
      const t4 = cue(4);
      const p4 = u.easeOut(u.seg(t, t4 + 0.2, t4 + 0.9));
      if (p4 > 0) u.label(ctx, `结果是 ${result} ${unit}`, W / 2, H * 0.86, { size: Math.min(H * 0.07, W * 0.05), color: u.C.green, alpha: p4 });
    }
  },

  /* ================= 10. 认识分数：分一分 ================= */
  fractionIntro: {
    title: '分一分——认识分数',
    duration: 20,
    draw(ctx, W, H, t, u, data) {
      const a = (data && data.a != null) ? data.a : 1;
      const b = (data && data.b != null) ? data.b : 5;
      const cue = u.cue;
      const cx = W / 2, cy = H * 0.46, R = Math.min(W * 0.28, H * 0.28);
      u.label(ctx, `平均分成 ${b} 份`, W / 2, H * 0.12, { size: Math.min(H * 0.08, W * 0.055), color: u.C.text, bold: true });
      // 圆
      const t0 = cue(0);
      const circ = u.easeOut(u.seg(t, t0 + 0.2, t0 + 0.9));
      if (circ > 0) {
        ctx.save(); ctx.globalAlpha = circ;
        ctx.strokeStyle = u.C.line; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      // 第 1 句：分成 b 份（扇形线）
      const t1 = cue(1);
      for (let i = 1; i < b; i++) {
        const ang = (i / b) * Math.PI * 2 - Math.PI / 2;
        const p = u.easeOut(u.seg(t, t1 + 0.2 + i * 0.18, t1 + 0.7 + i * 0.18));
        if (p > 0) {
          ctx.save(); ctx.globalAlpha = p; ctx.strokeStyle = u.C.line; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); ctx.stroke();
          ctx.restore();
        }
      }
      // 第 2~3 句：涂 a 份（绿）
      const t2 = cue(2), t3 = cue(3);
      for (let i = 0; i < a; i++) {
        const a0 = (i / b) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1) / b) * Math.PI * 2 - Math.PI / 2;
        const p = u.easeOut(u.seg(t, t2 + 0.3 + i * 0.3, t2 + 0.9 + i * 0.3));
        if (p > 0) {
          ctx.save(); ctx.globalAlpha = p; ctx.fillStyle = u.C.greenSoft;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
      // 标注分母 b（第 3 句）与分子 a（第 4 句）
      if (t3 > 0) {
        const p = u.easeOut(u.seg(t, t3 + 0.2, t3 + 0.9));
        if (p > 0) u.label(ctx, '分母 ' + b, cx, cy + R + H * 0.08, { size: Math.min(H * 0.07, W * 0.05), color: u.C.blue, alpha: p });
      }
      const t4 = cue(4);
      if (t4 > 0) {
        const p = u.easeOut(u.seg(t, t4 + 0.2, t4 + 0.9));
        if (p > 0) u.label(ctx, b + ' 分之 ' + a, cx, cy, { size: R * 0.5, color: u.C.green, bold: true, alpha: p });
      }
    }
  },

  /* ================= 11. 除法：平均分 ================= */
  divideEqual: {
    title: '平均分——除法的意义',
    duration: 19,
    draw(ctx, W, H, t, u, data) {
      const total = (data && data.total != null) ? data.total : 12;
      const groups = (data && data.groups != null) ? data.groups : 4;
      const each = (data && data.each != null) ? data.each : total / groups;
      const unit = (data && data.unit) || '个';
      const cue = u.cue;
      const r = Math.min(W * 0.03, H * 0.04, W / (total * 2.2));
      const gap = r * 2.2;
      const poolY = H * 0.28;
      const x0 = (W - total * gap) / 2 + gap / 2;
      // 篮子位置
      const basketGap = W * 0.5 / Math.max(groups, 1);
      const bX = (g) => W * 0.25 + g * basketGap;
      const bY = H * 0.66;

      u.label(ctx, `${total} 个，平均分成 ${groups} 份`, W / 2, H * 0.12, { size: Math.min(H * 0.075, W * 0.05), color: u.C.text, bold: true });
      const t0 = cue(0), t1 = cue(1), t2 = cue(2), t3 = cue(3);
      // 源堆
      for (let i = 0; i < total; i++) {
        const p = u.easeOut(u.seg(t, t0 + 0.2 + i * 0.08, t0 + 0.5 + i * 0.08));
        if (p > 0) u.dot(ctx, x0 + i * gap, poolY, r * p, u.C.red);
      }
      // 篮子
      for (let g = 0; g < groups; g++) {
        const appear = u.easeOut(u.seg(t, t1 + 0.2 + g * 0.15, t1 + 0.6 + g * 0.15));
        if (appear > 0) {
          ctx.save(); ctx.globalAlpha = appear; ctx.strokeStyle = u.C.blue; ctx.lineWidth = 2.5;
          u.roundRect(ctx, bX(g) - r * 2, bY - r * 1.6, r * 4, r * 3.2, 6); ctx.stroke();
          u.label(ctx, '第' + (g + 1) + '份', bX(g), bY + r * 2.4, { size: r * 1.1, color: u.C.blue });
          ctx.restore();
        }
      }
      // 分配：每一轮每个篮子放一个
      const tPer = (g, k) => u.easeInOut(u.seg(t, t2 + 0.3 + (g * each + k) * 0.12, t2 + 0.8 + (g * each + k) * 0.12));
      for (let g = 0; g < groups; g++) {
        for (let k = 0; k < each; k++) {
          const idx = g * each + k;
          const p = tPer(g, k);
          if (p > 0) {
            const fromX = x0 + idx * gap, fromY = poolY;
            const toX = bX(g) + (k - (each - 1) / 2) * (r * 1.6), toY = bY;
            u.dot(ctx, fromX + (toX - fromX) * p, fromY + (toY - fromY) * p, r, u.C.red);
          }
        }
      }
      const items = [String(total), '÷', String(groups), '=', String(each)];
      const fs = Math.min(H * 0.12, W * 0.075);
      const step = fs * 0.8;
      let x = W / 2 - (items.length * step) / 2 + step / 2;
      const t4 = cue(4);
      const cols = [u.C.red, u.C.sub, u.C.blue, u.C.sub, u.C.green];
      items.forEach((ch, i) => {
        const p = u.easeOut(u.seg(t, t4 + 0.3 + i * 0.3, t4 + 0.75 + i * 0.3));
        if (p > 0) u.label(ctx, ch, x, H * 0.9 - (1 - p) * fs * 0.2, { size: fs, color: cols[i], bold: true });
        x += step;
      });
    }
  },


  /* ================= 13. 长方形面积：铺方格 ================= */
  rectangleArea: {
    title: '长方形面积',
    duration: 19,
    draw(ctx, W, H, t, u, data) {
      const w = (data && data.w != null) ? data.w : 8;
      const h = (data && data.h != null) ? data.h : 4;
      const area = (data && data.area != null) ? data.area : w * h;
      const unit = (data && data.unit) || '厘米';
      const cue = u.cue;
      const bw = W * 0.5, bh = bw * (h / w);
      const x0 = (W - bw) / 2, y0 = H * 0.26;
      const cw = bw / w, ch = bh / h;

      u.label(ctx, `长 ${w}${unit}，宽 ${h}${unit}`, W / 2, H * 0.12, { size: Math.min(H * 0.08, W * 0.055), color: u.C.text, bold: true });
      // 外框
      const t0 = cue(0);
      const box = u.easeOut(u.seg(t, t0 + 0.2, t0 + 0.9));
      if (box > 0) {
        ctx.save(); ctx.globalAlpha = box; ctx.strokeStyle = u.C.line; ctx.lineWidth = 2.5;
        ctx.strokeRect(x0, y0, bw, bh); ctx.restore();
      }
      // 网格线 + 逐格填充
      const t1 = cue(1), t2 = cue(2);
      const total = w * h;
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const idx = r * w + c;
          const p = u.easeOut(u.seg(t, t1 + 0.3 + idx * 0.03, t1 + 0.7 + idx * 0.03));
          if (p > 0) {
            ctx.save(); ctx.globalAlpha = 0.25 + 0.55 * p; ctx.fillStyle = u.C.greenSoft;
            ctx.fillRect(x0 + c * cw + 1, y0 + r * ch + 1, cw - 2, ch - 2); ctx.restore();
          }
          if (idx === total - 1) {
            const g2 = u.seg(t, t2 + 0.2, t2 + 0.9);
            ctx.save(); ctx.globalAlpha = g2; ctx.strokeStyle = u.C.line; ctx.lineWidth = 1;
            for (let cc = 1; cc < w; cc++) { ctx.beginPath(); ctx.moveTo(x0 + cc * cw, y0); ctx.lineTo(x0 + cc * cw, y0 + bh); ctx.stroke(); }
            for (let rr = 1; rr < h; rr++) { ctx.beginPath(); ctx.moveTo(x0, y0 + rr * ch); ctx.lineTo(x0 + bw, y0 + rr * ch); ctx.stroke(); }
            ctx.restore();
          }
        }
      }
      const items = [String(w), '×', String(h), '=', String(area)];
      const fs = Math.min(H * 0.13, W * 0.08);
      const step = fs * 0.82;
      let x = W / 2 - (items.length * step) / 2 + step / 2;
      const t3 = cue(3), t4 = cue(4);
      const cols = [u.C.red, u.C.sub, u.C.blue, u.C.sub, u.C.green];
      items.forEach((ch, i) => {
        const p = u.easeOut(u.seg(t, (i < 3 ? t3 : t4) + 0.3 + i * 0.3, (i < 3 ? t3 : t4) + 0.75 + i * 0.3));
        if (p > 0) u.label(ctx, ch, x, H * 0.82 - (1 - p) * fs * 0.2, { size: fs, color: cols[i], bold: true });
        x += step;
      });
      if (t4 > 0) {
        const p = u.easeOut(u.seg(t, t4 + 0.4, t4 + 1.0));
        if (p > 0) u.label(ctx, `面积 ${area} 平方厘米`, W / 2, H * 0.93, { size: Math.min(H * 0.07, W * 0.05), color: u.C.green, alpha: p });
      }
    }
  },

  /* ================= 14. 连加：a+b+c ================= */
  chainAdd: {
    title: '连加——从左到右算',
    duration: 18,
    draw(ctx, W, H, t, u, data) {
      const a = (data && data.a != null) ? data.a : 3;
      const b = (data && data.b != null) ? data.b : 4;
      const c = (data && data.c != null) ? data.c : 5;
      const ab = (data && data.ab != null) ? data.ab : a + b;
      const sum = (data && data.sum != null) ? data.sum : ab + c;
      const unit = (data && data.unit) || '个';
      const cue = u.cue;
      const r = Math.min(W * 0.035, H * 0.05);
      const gap = r * 2.4;
      const cy = H * 0.4;
      const blocks = [a, b, c];
      const t0 = cue(0), t1 = cue(1), t2 = cue(2), t3 = cue(3);
      let x = W * 0.12;
      const starts = [t0, t0 + 0.3, t0 + 0.6];
      blocks.forEach((cnt, bi) => {
        for (let i = 0; i < cnt; i++) {
          const p = u.easeOut(u.seg(t, starts[bi] + i * 0.1, starts[bi] + 0.5 + i * 0.1));
          if (p > 0) u.dot(ctx, x + i * gap, cy, r * p, bi === 1 ? u.C.blue : (bi === 2 ? u.C.amber : u.C.red));
        }
        x += cnt * gap + r * 4;
      });
      // 第 1 句：第三步出现 + 号
      if (t1 > 0) {
        const p = u.seg(t, t1 + 0.2, t1 + 0.8);
        u.label(ctx, '再把第三个加进来', W / 2, H * 0.58, { size: Math.min(H * 0.06, W * 0.045), color: u.C.sub, alpha: p });
      }
      const items = [String(a), '+', String(b), '+', String(c), '=', String(sum)];
      const fs = Math.min(H * 0.12, W * 0.07);
      const step = fs * 0.78;
      let sx = W / 2 - (items.length * step) / 2 + step / 2;
      const t4 = cue(4);
      const cols = [u.C.red, u.C.sub, u.C.blue, u.C.sub, u.C.amber, u.C.sub, u.C.green];
      items.forEach((ch, i) => {
        const p = u.easeOut(u.seg(t, t3 + 0.3 + i * 0.25, t3 + 0.6 + i * 0.25));
        if (p > 0) u.label(ctx, ch, sx, H * 0.82 - (1 - p) * fs * 0.2, { size: fs, color: cols[i] || u.C.text, bold: true });
        sx += step;
      });
    }
  },

  /* ================= 15. 连减 / 加减混合 ================= */
  chainSub: {
    title: '连减与加减混合',
    duration: 19,
    draw(ctx, W, H, t, u, data) {
      const a = (data && data.a != null) ? data.a : 12;
      const b = (data && data.b != null) ? data.b : 4;
      const c = (data && data.c != null) ? data.c : 3;
      const op1 = (data && data.op1 === 'add') ? '+' : '-';
      const op2 = (data && data.op2 === 'add') ? '+' : '-';
      const x = (data && data.x != null) ? data.x : (op1 === '+' ? a + b : a - b);
      const result = (data && data.result != null) ? data.result : (op2 === '+' ? x + c : x - c);
      const unit = (data && data.unit) || '个';
      const cue = u.cue;
      const total = a;
      const r = Math.min(W * 0.035, H * 0.05, W / (total * 2.2));
      const gap = r * 2.2;
      const x0 = (W - total * gap) / 2 + gap / 2;
      const cy = H * 0.42;

      u.label(ctx, `${a} ${op1} ${b} ${op2} ${c} = ?`, W / 2, H * 0.12, { size: Math.min(H * 0.075, W * 0.05), color: u.C.text, bold: true });
      const t0 = cue(0), t1 = cue(1), t2 = cue(2), t3 = cue(3);
      // 第一操作影响前 b 个（或加 b 个）
      for (let i = 0; i < total; i++) {
        const p0 = u.easeOut(u.seg(t, t0 + 0.2 + i * 0.1, t0 + 0.5 + i * 0.1));
        let alpha = 1, dy = 0;
        if (op1 === '-' && i >= total - b) {
          const fly = u.easeInOut(u.seg(t, t1 + 0.3 + (i - (total - b)) * 0.15, t1 + 1.2 + (i - (total - b)) * 0.15));
          alpha = 1 - fly; dy = -fly * H * 0.2;
        }
        if (p0 > 0 && alpha > 0.02) u.dot(ctx, x0 + i * gap, cy + dy, r * p0, u.C.red, alpha);
      }
      // 第二操作：从 x 个里再去掉 c 个（仅当 op2 为减）
      if (op2 === '-') {
        const xStart = total - b; // 剩余起点
        for (let i = 0; i < c; i++) {
          const idx = xStart - 1 - i;
          if (idx < 0) break;
          const fly = u.easeInOut(u.seg(t, t2 + 0.3 + i * 0.15, t2 + 1.2 + i * 0.15));
          const baseX = x0 + idx * gap, baseY = cy;
          u.dot(ctx, baseX, baseY - fly * H * 0.2, r, u.C.red, 1 - fly);
        }
      }
      const items = [String(a), op1, String(b), op2, String(c), '=', String(result)];
      const fs = Math.min(H * 0.12, W * 0.07);
      const step = fs * 0.78;
      let sx = W / 2 - (items.length * step) / 2 + step / 2;
      const t4 = cue(4);
      const cols = [u.C.red, u.C.sub, u.C.blue, u.C.sub, u.C.amber, u.C.sub, u.C.green];
      items.forEach((ch, i) => {
        const p = u.easeOut(u.seg(t, t3 + 0.3 + i * 0.25, t3 + 0.6 + i * 0.25));
        if (p > 0) u.label(ctx, ch, sx, H * 0.82 - (1 - p) * fs * 0.2, { size: fs, color: cols[i] || u.C.text, bold: true });
        sx += step;
      });
    }
  },

  /* ================= 16. 两位数竖式加减（进位/退位） ================= */
  columnOp: {
    title: '竖式计算——进位与退位',
    duration: 20,
    draw(ctx, W, H, t, u, data) {
      const a = (data && data.a != null) ? data.a : 36;
      const b = (data && data.b != null) ? data.b : 18;
      const op = (data && data.op === 'sub') ? '-' : '+';
      const result = (data && data.result != null) ? data.result : (op === '-' ? a - b : a + b);
      const cue = u.cue;
      const fs = Math.min(H * 0.16, W * 0.1);
      const rightX = W * 0.52;     // 数字右对齐基准
      const yTop = H * 0.30;
      const dy = fs * 1.4;
      const digitW = fs * 0.62;
      const aStr = String(a), bStr = String(b);
      u.label(ctx, `${a} ${op} ${b} = ?`, W / 2, H * 0.12, { size: Math.min(H * 0.08, W * 0.055), color: u.C.text, bold: true });

      const drawNum = (str, y, col, revealT) => {
        ctx.textAlign = 'right';
        for (let i = 0; i < str.length; i++) {
          const p = u.easeOut(u.seg(t, revealT + 0.2 + i * 0.15, revealT + 0.6 + i * 0.15));
          if (p > 0) u.label(ctx, str[i], rightX - (str.length - 1 - i) * digitW, y, { size: fs, color: col, bold: true, align: 'right' });
        }
        ctx.textAlign = 'center';
      };
      const t0 = cue(0), t1 = cue(1), t2 = cue(2), t3 = cue(3), t4 = cue(4);
      drawNum(aStr, yTop, u.C.red, t0);
      // 运算符 + 第二数（右移一位）
      if (t1 > 0) {
        const p = u.easeOut(u.seg(t, t1 + 0.2, t1 + 0.7));
        u.label(ctx, op, rightX - (bStr.length) * digitW - digitW * 0.5, yTop + dy, { size: fs, color: u.C.sub, bold: true, align: 'center' });
        drawNum(bStr, yTop + dy, u.C.blue, t1);
      }
      // 横线
      if (t2 > 0) {
        const p = u.easeOut(u.seg(t, t2 + 0.2, t2 + 0.7));
        ctx.save(); ctx.globalAlpha = p; ctx.strokeStyle = u.C.sub; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(rightX - (Math.max(aStr.length, bStr.length)) * digitW - digitW, yTop + dy * 1.5);
        ctx.lineTo(rightX + digitW * 0.3, yTop + dy * 1.5); ctx.stroke(); ctx.restore();
      }
      // 进位/退位提示
      if (t2 > 0) {
        const carry = op === '+' && (a % 10 + b % 10 >= 10);
        const borrow = op === '-' && (a % 10 < b % 10);
        const p = u.seg(t, t2 + 0.4, t2 + 1.2);
        const tip = carry ? '个位满十，向十位进一' : borrow ? '个位不够减，从十位退一当十' : '个位算完，再算十位';
        u.label(ctx, tip, W / 2, yTop + dy * 2.4, { size: Math.min(H * 0.06, W * 0.045), color: u.C.amber, alpha: p });
      }
      drawNum(String(result), yTop + dy * 2, u.C.green, t3);
      if (t4 > 0) {
        const p = u.easeOut(u.seg(t, t4 + 0.2, t4 + 0.9));
        u.label(ctx, `结果是 ${result}`, W / 2, H * 0.88, { size: Math.min(H * 0.07, W * 0.05), color: u.C.green, bold: true, alpha: p });
      }
    }
  },


  /* ================= 18. 概念卡（兜底：无法直接运算的节） ================= */
  conceptCard: {
    title: '本节要点',
    duration: 16,
    // data: { title, relation, relation2, tip }，由 map.resolveAnim 用 text.pickRaw 注入
    //   relation/relation2/tip 各 ≤26 字（超出在标点处截断），渲染时自动折 2 行
    // 5 个 cue 与 narration_kp 的 5 句一一对应：标题 / 要点1 / 要点2 / 易错 / 鼓励
    draw(ctx, W, H, t, u, data) {
      const d = data || {};
      const title = d.title || '本节要点';
      const relation = d.relation || '先把概念读清楚，再动手做题。';
      const relation2 = d.relation2 || '';
      const tip = d.tip || '做完记得检查。';
      const cue = u.cue;
      const pad = W * 0.08;
      const cardX = pad, cardY = H * 0.09, cardW = W - pad * 2, cardH = H * 0.71;
      const t0 = cue(0), t1 = cue(1), t2 = cue(2), t3 = cue(3), t4 = cue(4);
      const midX = cardX + cardW / 2;
      const innerW = cardW - W * 0.08;
      const fsSmall = Math.min(H * 0.045, W * 0.031);
      const fsBody = Math.min(H * 0.05, W * 0.034);
      const lineH = fsBody * 1.26;
      const perLine = Math.max(8, Math.floor(innerW / fsBody));

      // 标题自适应：单元名最长有 15~18 字（"跳绳——求比一个数多几、少几"），
      // 按 0.048W 直接画会顶出卡片。先缩字号，缩到下限还放不下再截断。
      let fsTitle = Math.min(H * 0.07, W * 0.048);
      const titleMaxW = cardW - W * 0.10;
      while (fsTitle > W * 0.03 && title.length * fsTitle > titleMaxW) fsTitle *= 0.92;
      let titleText = title;
      if (titleText.length * fsTitle > titleMaxW) {
        titleText = titleText.slice(0, Math.max(4, Math.floor(titleMaxW / fsTitle) - 1)) + '…';
      }

      const cardA = u.easeOut(u.seg(t, t0 + 0.2, t0 + 0.9));
      if (cardA > 0) {
        ctx.save(); ctx.globalAlpha = cardA;
        ctx.fillStyle = u.C.blueSoft; ctx.strokeStyle = u.C.blue; ctx.lineWidth = 2.5;
        u.roundRect(ctx, cardX, cardY, cardW, cardH, 14); ctx.fill(); ctx.stroke();
        u.label(ctx, '这一节', midX, cardY + H * 0.055, { size: fsSmall, color: u.C.blue });
        u.label(ctx, titleText, midX, cardY + H * 0.125, { size: fsTitle, color: u.C.text, bold: true });
        ctx.restore();
      }

      // 要点 1（可折 2 行）
      const relA = u.easeOut(u.seg(t, t1 + 0.2, t1 + 0.9));
      if (relA > 0) {
        ctx.save(); ctx.globalAlpha = relA;
        u.label(ctx, '要点', midX, cardY + H * 0.215, { size: fsSmall, color: u.C.sub });
        wrapByChars(ctx, relation, midX, cardY + H * 0.285, perLine, lineH, fsBody, u.C.text);
        ctx.restore();
      }
      // 要点 2（没有第二句就不画，画面停住让学生听）
      if (relation2) {
        const rel2A = u.easeOut(u.seg(t, t2 + 0.2, t2 + 0.9));
        if (rel2A > 0) {
          ctx.save(); ctx.globalAlpha = rel2A;
          wrapByChars(ctx, relation2, midX, cardY + H * 0.415, perLine, lineH, fsBody, u.C.text);
          ctx.restore();
        }
      }
      // 易错提醒
      const tipA = u.easeOut(u.seg(t, t3 + 0.2, t3 + 0.9));
      if (tipA > 0) {
        ctx.save(); ctx.globalAlpha = tipA;
        ctx.fillStyle = u.C.redSoft;
        u.roundRect(ctx, cardX + W * 0.04, cardY + cardH - H * 0.22, cardW - W * 0.08, H * 0.18, 10); ctx.fill();
        u.label(ctx, '易错提醒', midX, cardY + cardH - H * 0.175, { size: fsSmall, color: u.C.red });
        wrapByChars(ctx, tip, midX, cardY + cardH - H * 0.105, perLine, lineH, fsBody, u.C.red);
        ctx.restore();
      }
      // 鼓励
      const endA = u.easeOut(u.seg(t, t4 + 0.2, t4 + 0.9));
      if (endA > 0) {
        u.label(ctx, '跟着动画再看一遍，然后做一道题', W / 2, cardY + cardH + H * 0.048,
          { size: Math.min(H * 0.045, W * 0.032), color: u.C.green, alpha: endA });
      }
    }
  }
};

/* 概念卡用的折行（canvas 无自动换行）。
   按字数切而不是 measureText：布局位置要提前算（正文 2 行会影响到哪去），
   measureText 得先画一次才知道宽度，节奏反而更乱；CJK 每字宽≈字号，按字数足够准。
   切点优先落在标点上，避免「是完全相 / 同的圆」这种断法。 */
function wrapByChars(ctx, text, cx, y, perLine, lineH, size, color) {
  const s = String(text || '');
  if (!s) return;
  const lines = [];
  let rest = s;
  while (rest.length > perLine && lines.length < 2) {
    const cut = rest.slice(0, perLine);
    const i = Math.max(cut.lastIndexOf('，'), cut.lastIndexOf('、'), cut.lastIndexOf('；'), cut.lastIndexOf('。'));
    const j = i >= perLine * 0.55 ? i + 1 : perLine;
    lines.push(rest.slice(0, j));
    rest = rest.slice(j);
  }
  if (rest) lines.push(rest);
  ctx.save();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${size}px sans-serif`;
  lines.forEach((ln, i) => ctx.fillText(ln, cx, y + i * lineH));
  ctx.restore();
}

module.exports = SCENES;
