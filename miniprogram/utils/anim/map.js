// utils/anim/map.js —— 知识点 → 动画场景 的统一解析器
//
// 这是「486 个知识点批量补动画」的总入口。一节的动画怎么来，按优先级：
//   1) MAP 里的显式覆盖（7 个旗舰节点，数据用演示值、保留预打包语音）
//   2) autoMap：从第一题题干抽数字 + 安全闸（算出来等于答案才放行）
//   3) conceptCard 兜底：认识数、测量、几何性质、大数、统计等「无法直接运算」的节，
//      用动画概念卡 + 逐知识点字幕讲解（零包体积，绕开 20MB 语音上限）
//
// 没匹配到任何可演示运算的节点，不再「整块不显示动画区」，而是给一张概念卡，
// 讲解（字幕）照常 —— 所以现在 493 个知识点全部有动画 + 讲解，只是形态不同：
//   · 运算动画（真实题目数字驱动）：覆盖可参数化的算术题
//   · 概念卡（标题 + 要点 + 易错）：覆盖其余概念性节点

const { autoMap } = require('./autoMap.js');
const { has: sceneExists } = require('./engine.js');
const { narrationNodeOf } = require('./narration_nodes.js');
const { hasConceptAudio } = require('./narration_concept.js');
const { pickRaw } = require('./text.js');

/* 7 个旗舰节点：固定场景 + 演示数据 + 预打包语音 mp3（教室无网也能放声） */
const MAP = {
  'bsd-g1s-010': 'addMeaning',
  'bsd-g1x-004': 'makeTen',
  'bsd-g3x-015': 'perimeter',
  'bsd-g3x-016': 'perimeter',
  'bsd-g3x-017': 'perimeter',
  'bsd-g3x-018': 'perimeter',
  'bsd-g5x-013': 'fractionAdd'
};

/** 旧接口：只给场景名（保持向后兼容，部分老调用仍在用） */
function sceneOf(nodeId) {
  return MAP[nodeId] || '';
}

/**
 * 统一解析一节知识点对应的动画。
 * @param {object} node  content.js 的节点（需要 title / story / wrongTip）
 * @returns {{scene:string, data:object|undefined, legacy:boolean, hasAudio:boolean}}
 *   legacy=true 表示走 MAP 显式覆盖、用预打包语音；
 *   data=undefined 表示场景用内置演示数据（仅 7 旗舰节点）；
 *   hasAudio=true 表示该节点已有预打包语音（旗舰 或 已生成逐句 mp3 的运算节点），
 *               learn 层据此决定是否加载音频分包、接上语音播放。
 */
function resolveAnim(node) {
  if (!node) return { scene: 'conceptCard', data: { title: '', relation: '', relation2: '', tip: '' }, legacy: false, hasAudio: false, audioKind: '' };

  // 1) 旗舰节点显式覆盖
  if (MAP[node.id]) {
    return { scene: MAP[node.id], data: undefined, legacy: true, hasAudio: true, audioKind: 'subpackage' };
  }

  // 2) 自动映射：真实题目数据驱动
  const auto = autoMap(node);
  if (auto && sceneExists(auto.scene)) {
    // 运算动画节点若有预打包逐句语音则 hasAudio=true（离线可放声），否则仅字幕
    const hasAudio = !!narrationNodeOf(node.id);
    return { scene: auto.scene, data: auto.data, legacy: false, hasAudio, audioKind: hasAudio ? 'subpackage' : '' };
  }

  // 3) 概念卡兜底：标题 + 两行要点 + 一行易错
  //    画面用 pickRaw（保留阿拉伯数字，数形对照直观）；语音/字幕在同名场景里
  //    另走 speakable（数字转中文），两者共用同一套切句，不会各说各话。
  const rel = pickRaw(node.story || '', 2, 26, { key: true });
  const tipRaw = pickRaw(node.wrongTip || '', 1, 26);
  // 概念卡语音走云存储（428 卡 ≈ 40MB，塞不进 2048KB 单分包），
  // 客户端按需下载缓存，失败降级字幕。
  const cloudAudio = hasConceptAudio(node.id);
  return {
    scene: 'conceptCard',
    data: {
      title: node.title || '',
      relation: rel[0] || '',
      relation2: rel[1] || '',
      tip: tipRaw[0] || ''
    },
    legacy: false,
    hasAudio: cloudAudio,
    audioKind: cloudAudio ? 'cloud' : ''
  };
}

module.exports = { MAP, sceneOf, resolveAnim };
