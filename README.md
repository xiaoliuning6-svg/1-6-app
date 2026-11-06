# 数学跟课练 · 微信小程序（北师大版第五版）

> 面向：小宁（教务主任），小学 1–6 年级数学教学提效（校内使用、非商业化）
> 当前状态：**12 册内容全量、本机可离线跑通、云环境可选**。本地 Node 模拟 + 无头浏览器自检通过，**真机/微信开发者工具尚未验证**。

---

## 一句话说清架构

**内容打进小程序包，行为数据上云；动画用代码画，语音单独进分包。**

| 数据 | 存哪 | 为什么 |
|---|---|---|
| 知识点 + 题目（493 讲 / 1972 题） | `miniprogram/data/content.js`，1222.3 KB | 打开就能用、没网也能刷、不占云调用次数 |
| 动画场景（4 套模板 / 覆盖 7 个知识点） | `miniprogram/utils/anim/*.js` | 纯代码绘制，不占图片体积；没配场景的知识点整块不显示，不影响其余流程 |
| 语音旁白（20 句 mp3，447.5 KB） | `miniprogram/assets/audio/`，分包名 `audio` | 不占主包；首页 `preloadRule` 预下载，下过一次之后离线可用；失败或超 1.5 秒自动降级为纯字幕 |
| 练习记录 / 错题 / 报告 | 本机 storage；填了云环境后同步上云 | 只有跨手机汇总才需要云，一个班各自手机上的记录要在老师这里合起来 |

不填云环境 ID 也能完整使用（「本机模式」）：能看、能讲、能练、能判、能看报告、能播动画和语音，只是数据不跨设备。

当前体积：主包 **1333.3 KB / 2048 KB（65.1%）**，`audio` 分包 **447.5 KB（21.8%）**。再加图片或习题前，必须先按年级分包。

---

## 目录结构

```
math-pilot/
├── project.config.json          # appid 在这里改
├── miniprogram/
│   ├── app.js                   # 云环境初始化；未填 env 则进本机模式
│   ├── app.json / app.wxss      # 5 个主包页面 + assets 音频分包 + 首页预下载
│   ├── data/content.js          # ★ 全量内容（构建产物，勿手改）
│   ├── pages/
│   │   ├── index/               # 首页：两列选册、单元索引、三态进度、继续上次
│   │   ├── learn/               # 学习页：讲解 / 练习双模式、同册翻页、动画+语音
│   │   ├── wrong/               # 错题本
│   │   ├── report/              # 学习报告（机器判分正确率 + 自评单列）
│   │   └── teacher/             # 教师端：内容覆盖、本机概况、班级汇总
│   ├── utils/
│   │   ├── cloud.js / auth.js / format.js
│   │   └── anim/                # engine / scenes / map / narration / player
│   └── assets/audio/            # 预生成 mp3（分包，不进主包）
├── cloudfunctions/              # 6 个云函数
│   ├── getOpenid/               # 身份
│   ├── seedContent/             # ★ 一键入库（分片、幂等、断点续写）
│   ├── getContent/              # 内容读取通道（不发版改题的逃生口）
│   ├── submitAnswer/            # 服务端逐题判分 + 写 practice_records / wrong_questions
│   ├── getClassStats/           # 班级错题聚合
│   └── genReport/               # 规则版报告
├── cloud_import/                # 控制台导入用：knowledge_nodes.jsonl / questions.jsonl
└── tools/                       # 全部自检脚本，见下文
```

---

## 两种使用模式

### 讲解模式（老师投屏）

- 故事默认展开、字号 38rpx（投屏能看清）
- 每题下方一个「看答案」按钮，讲到哪点哪，也可以「全部显示」
- 配了动画场景的知识点自动播放「画面 + 语音 + 字幕」；动画默认展开，练习模式默认收起（否则等于看答案）
- **不判分、不写库**，只在本机记一条「这节讲过了」

### 练习模式（学生作答）

- 选择/判断点选，填空输入，解答题写算式
- 提交后逐题打 ✓/✗，显示正确答案与解析
- **解答题不自动判分**：小学算式写法太多（`3×3+5×2` / `5×2+3×3` / 分步写），机器比对必然误杀；改为提交后显示参考答案，学生自己勾「写对了 / 写错了」
- 底部固定翻页条「上一节 / 第 N 节 · 本单元 x/y / 下一节」，用 `redirectTo` 原地换节，避免页面栈堆到 10 层

---

## 判分与正确率口径（前后端必须一致）

判分写了两份：`pages/learn/learn.js` 的 `norm()` 与 `cloudfunctions/submitAnswer/index.js` 的 `judge()`。两边一旦不同步，就会出现「手机上说对了、老师端记成错」这种最难查的 bug。

| 题型 | 判定方式 | 进正确率？ |
|---|---|---|
| 选择 / 判断 | 去空格后忽略大小写全等 | 进 |
| 填空 | 归一化后全等：全角→半角、`×÷`→`*/`、`＝`→`=`、去掉中英文标点与所有空白 | 进 |
| 解答 | **不比对**，学生自评 | **不进** |

正确率只认机器判分题。新记录格式 `v: 2`：

```js
progress[node.id] = {
  autoCorrect, autoTotal,     // 机器判分题，正确率唯一来源
  correct, total,             // 兼容别名，语义已收窄为「只指机器判分」
  selfCorrect, selfTotal,     // 解答题自评，单列展示
  v: 2,
  at: Date.now()
};
```

关键约束：

- 自评题全勾「会了」**不能**把正确率从 0% 刷成 25% 或 100%；`tools/test_pages.js` 与 `tools/test_submit_answer.js` 都有这条反例。
- 旧记录（无 `v: 2`，`correct` 混过自评）不删、仍算「练过」、绿点保留，但排除出正确率，并在报告页提示「重做一次即可更新」。
- 整节都是解答题时，不显示「0% 要重讲」，改显示「暂无机器判分成绩」。
- 错题本仍收机器判错的题，以及自评标「不会」的解答题。
- 云函数 `submitAnswer` 落库、`genReport` 汇总、教师端、报告页全部按同一口径；改任一边必须重跑口径测试。

---

## 动画与语音的关键约束

- **写模板不写片子**：493 个知识点各做一支不现实；`engine.js` 给缓动/绘制原语，`scenes.js` 是 `draw(ctx,W,H,t,u)` 纯函数（不依赖 wx/DOM），`map.js` 做 id→场景映射。新增动画＝加一行映射。
- 所有尺寸按画布比例算，禁止写死像素；与字号/半径相关的位置必须用 `r/gap` 推导。
- **时间轴由音频实测时长反推**，不能反过来：改旁白文案 → `tools/narration_src.json` → `tools/gen_narration.py` → 生成 mp3 与 `narration.js`。场景动作全部挂 `u.cue(i)`，禁止写死秒数。
- `player.js` 用 rAF 自己走时钟，不拿 `onTimeUpdate` 当主时钟；每句一个 `innerAudioContext`，且必须设 `obeyMuteSwitch = false`（教室手机常年静音）；单帧推进夹 0.2 秒防切后台跳结尾。
- 旁白文案不许阿拉伯数字、斜杠、破折号；`tools/test_narration.js` 会拦这几类，并断言 mp3 时长与 `dur` 吻合。

当前 4 个场景：加法的意义 / 凑十法 / 周长 / 分数条，覆盖 7 个知识点（一上 1、一下 1、三下 4、五下 1），合计 20 句旁白、1655 帧逐帧扫描通过。

---

## 自检与验收

```bash
# 内容侧（content_bsd 目录）
node check_bsd.js               # 原稿：12 册、493 知识点、1972 题、题型/字数/答案分布
node verify_content.js          # 产物复核：逐题比对 1972/1972（另一套正则，不是 build 自证）
node test_judge_consistency.js  # 前后端判分口径 + 自评不进 correct

# 小程序侧（math-pilot 目录）
node tools/lint_miniprogram.js  # 57 文件静态检查（语法/JSON/标签/绑定/主包+分包体积）
node tools/test_pages.js        # 5 页面运行时模拟（含「自评全勾对不刷分」反例）
node tools/test_seed_loop.js    # 云函数分片入库：幂等/断点续写/自动连写
node tools/test_anim.js         # 4 场景 1655 帧：无 NaN / 无越界 / 无空帧
node tools/test_narration.js    # 20 句旁白与音频时长对齐
node tools/test_submit_answer.js # 云端落库口径：自评绝不进 correct
node tools/preview_index.js     # 无头 Edge 生成首页预览 + 两列下拉/单元条/分数文案断言
node tools/check_anim.js        # 无头浏览器定格截图 + 字幕逐句比对
node tools/check_audio.js       # 无头浏览器验证语音起播顺序
```

本机九项主回归当前全绿：内容结构 0 异常、产物 1972/1972、判分 23 用例 + 17 样本、静态 1333.3 KB、5 页面全流程、入库分片、动画 1655 帧、旁白 20 句、云端判分口径。

> 注意：上面全是 Node 模拟 + 无头 Edge，**不等于真机通过**。给老师之前必须在微信开发者工具里手点一遍，重点试音频分包首次下载、iOS 静音键、切后台续播。

---

## 还没做的（说清楚，不含糊）

| 事项 | 说明 |
|---|---|
| 真机验证 | 本机没有微信开发者工具，只做了 Node 运行时模拟 + 无头浏览器；模拟器/真机必须再手点一遍 |
| 班级/学生体系 | 当前按 openid 记录，没有 `classId`。单班试点够用；多班并行要先给 `students` 加班级字段 |
| 动画覆盖 | 7 / 493 ≈ 1.4%，其余知识点仍是纯文字讲解。场景库要慢慢长，不阻塞使用 |
| 解析深度 | 1972 条解析平均 15.4 个字符（净汉字 7.8 字），偏短；适合「提示一句」，不适合独立补课 |
| 一年级内容 | 故事已压到 35–140 净汉字，但新生识字量 300–400 字，仍建议老师投屏带读 |
| 部分课时名 | 四上 / 四下 / 五下 / 六下的部分课时名仍为推定，需实物教材目录核对 |
| AI 报告 | 现在是规则版（可解释、可复现、零成本）。数字永远来自数据库，LLM 只可能用于措辞 |

---

## 改内容的正规流程

```bash
cd content_bsd
# 1. 改 g*_bsd.md 源文件（每块必须以 --- 结尾）
node check_bsd.js        # 2. 结构校验
node build_content.js    # 3. 生成产物
node verify_content.js   # 4. 独立复核（必须 1972/1972 全命中）
```

然后：

- 小程序内容要更新 → 重新编译上传（内容是打包的）
- 云数据库要同步 → 重新部署 `seedContent`，再调一次 `{"action":"seed",...}`（幂等）
- 改了判分口径 → `test_judge_consistency.js` + `test_submit_answer.js` 一起重跑

改动动画旁白后的顺序：改 `tools/narration_src.json` → 系统 Python 跑 `tools/gen_narration.py` 重新合成音频和时间轴 → `build_anim_demo.js` → `test_narration.js`。

详细入库步骤见项目根目录 `../入库操作手册.md`。
