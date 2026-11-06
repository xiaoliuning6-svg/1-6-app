# tools/gen_node_audio.py —— 给「运算动画」节点预打包逐句语音（per-node 目录）
#
# 背景：7 个旗舰节点已预打包 mp3（narration.js，按场景名）。其余 486 个知识点靠
# narration_kp.genNarration 生成字幕（零体积）。现在要把其中可演示运算的节点（约 58 个）
# 也预打包成语音，让它们变成「动画 + 语音 + 字幕」完整态，且离线可用。
#
# 与 gen_narration.py 的区别：
#   · 那个按「场景名」生成 4 套演示稿；
#   · 这个按「知识点 id」生成，每个节点用自己真实题目抽出的讲解文案（来自
#     tools/_anim_narration_dump.json），所以目录结构从 <场景>/<i>.mp3 变成
#     <nodeId>/<i>.mp3，narration_nodes.js 也按 nodeId 检索。
#
# 时间轴仍由音频实测时长反推（GAP/TAIL 与旗舰一致），动画按这份时间轴走，声画天然对齐。
#
# 用法：
#   /d/tool/software/python/python3.10.9/python.exe tools/gen_node_audio.py
import asyncio
import json
import os
import sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMP = os.path.join(ROOT, 'tools', '_anim_narration_dump.json')
SRC = os.path.join(ROOT, 'tools', 'narration_src.json')
AUDIO_DIR = os.path.join(ROOT, 'miniprogram', 'assets', 'audio')
OUT_JS = os.path.join(ROOT, 'miniprogram', 'utils', 'anim', 'narration_nodes.js')
DUR_CACHE = os.path.join(ROOT, 'tools', '_node_durations.json')

GAP = 0.18   # 句间停顿（秒）
TAIL = 0.80  # 最后一句后画面多留一会儿

# MPEG Layer III 参数表（edge-tts 输出 24kHz / 48kbps / mono，属 MPEG2 Layer3）
BITRATE_V2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
BITRATE_V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
SR_V1 = [44100, 48000, 32000, 0]
SR_V2 = [22050, 24000, 16000, 0]


def mp3_duration(path):
    """逐帧解析 mp3，返回秒数。没有 ffmpeg，只能自己读帧头。"""
    with open(path, 'rb') as f:
        data = f.read()
    i = 0
    if data[:3] == b'ID3':
        size = ((data[6] & 0x7F) << 21) | ((data[7] & 0x7F) << 14) \
             | ((data[8] & 0x7F) << 7) | (data[9] & 0x7F)
        i = 10 + size
    samples = 0
    rate = 0
    n = len(data)
    while i + 4 <= n:
        if data[i] != 0xFF or (data[i + 1] & 0xE0) != 0xE0:
            i += 1
            continue
        ver_bits = (data[i + 1] >> 3) & 0x03
        layer = (data[i + 1] >> 1) & 0x03
        br_idx = (data[i + 2] >> 4) & 0x0F
        sr_idx = (data[i + 2] >> 2) & 0x03
        pad = (data[i + 2] >> 1) & 0x01
        if layer != 1 or br_idx in (0, 15) or sr_idx == 3:
            i += 1
            continue
        if ver_bits == 3:
            bitrate = BITRATE_V1L3[br_idx] * 1000
            sr = SR_V1[sr_idx]
            spf = 1152
        else:
            bitrate = BITRATE_V2L3[br_idx] * 1000
            sr = SR_V2[sr_idx]
            spf = 576
        if not bitrate or not sr:
            i += 1
            continue
        frame_len = int(spf / 8 * bitrate / sr) + pad
        if frame_len <= 4:
            i += 1
            continue
        rate = sr
        samples += spf
        i += frame_len
    if not rate:
        return len(data) * 8 / 48000
    return samples / rate


async def synth(text, voice, rate, out_path):
    c = edge_tts.Communicate(text, voice, rate=rate)
    await c.save(out_path)


def _esc(s):
    return s.replace('\\', '\\\\').replace("'", "\\'")


def _render_js(out):
    head = (
        '// utils/anim/narration_nodes.js —— 运算动画节点的预打包逐句旁白（per-node）\n'
        '//\n'
        '// ⚠️ 本文件由 tools/gen_node_audio.py 自动生成，不要手改。\n'
        '//    文案来自 tools/_anim_narration_dump.json（由 narration_kp.genNarration\n'
        '//    用每个节点真实题目数据生成），改文案需重跑 dump + 本脚本。\n'
        '//\n'
        '// t    这句开始的时间（秒），由前面各句实测音频时长累加得出\n'
        '// dur  这句音频的真实时长（秒）\n'
        '// file 相对 miniprogram/assets/audio/ 的路径（<nodeId>/<i>.mp3）\n'
        '//\n'
        '// 优先级（见 engine.narrationForScene）：旗舰场景旁白 > per-node 旁白 > 自动字幕。\n\n'
        'const NARRATION_NODES = {\n'
    )
    body = []
    for nid, v in out.items():
        body.append(f"  '{nid}': {{\n    total: {v['total']},\n    lines: [\n")
        for ln in v['lines']:
            body.append("      { t: %s, dur: %s, text: '%s', file: '%s' },\n"
                        % (ln['t'], ln['dur'], _esc(ln['text']), ln['file']))
        body.append('    ]\n  },\n')
    tail = (
        '};\n\n'
        'function narrationNodeOf(nodeId) {\n'
        '  return NARRATION_NODES[nodeId] || null;\n'
        '}\n\n'
        'module.exports = { NARRATION_NODES, narrationNodeOf };\n'
    )
    return head + ''.join(body) + tail


async def main():
    with open(DUMP, 'r', encoding='utf-8') as f:
        dump = json.load(f)
    with open(SRC, 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    voice = cfg.get('_voice', 'zh-CN-XiaoxiaoNeural')
    rate = cfg.get('_rate', '-6%')

    dur_cache = {}
    if os.path.exists(DUR_CACHE):
        try:
            with open(DUR_CACHE, 'r', encoding='utf-8') as f:
                dur_cache = json.load(f)
        except Exception:
            dur_cache = {}

    os.makedirs(AUDIO_DIR, exist_ok=True)
    sem = asyncio.Semaphore(4)
    total_bytes = 0
    durations = {}   # (nodeId, idx) -> dur
    tasks_spec = []

    for e in dump:
        nid = e['id']
        d = os.path.join(AUDIO_DIR, nid)
        os.makedirs(d, exist_ok=True)
        for idx, text in enumerate(e['texts']):
            mp3 = os.path.join(d, f'{idx}.mp3')
            key = f'{nid}/{idx}'
            # 断点续跑：mp3 已存在且时长已缓存 → 直接复用，省一次 TTS 调用
            if os.path.exists(mp3) and os.path.getsize(mp3) > 1024 and key in dur_cache:
                durations[(nid, idx)] = dur_cache[key]
                total_bytes += os.path.getsize(mp3)
            else:
                tasks_spec.append((nid, idx, text, mp3, key))

    async def one(nid, idx, text, mp3, key):
        nonlocal total_bytes
        async with sem:
            for attempt in range(3):
                try:
                    await synth(text, voice, rate, mp3)
                    break
                except Exception as ex:
                    if attempt == 2:
                        print(f'  [FAIL] {nid}/{idx}: {ex}')
                        raise
                    await asyncio.sleep(1 + attempt)
        dur = mp3_duration(mp3)
        durations[(nid, idx)] = dur
        dur_cache[key] = dur
        total_bytes += os.path.getsize(mp3)
        print(f'  {nid}/{idx}.mp3  {dur:5.2f}s  {os.path.getsize(mp3)//1024:3d}KB  {text}')

    if tasks_spec:
        await asyncio.gather(*[one(*s) for s in tasks_spec])

    # 落盘时长缓存，便于下次续跑
    with open(DUR_CACHE, 'w', encoding='utf-8') as f:
        json.dump(dur_cache, f, ensure_ascii=False, indent=1)

    # 按实测时长排时间轴
    out = {}
    for e in dump:
        nid = e['id']
        lines = []
        t = 0.0
        for idx, text in enumerate(e['texts']):
            dur = durations[(nid, idx)]
            lines.append({
                't': round(t, 2),
                'dur': round(dur, 2),
                'text': text,
                'file': f'{nid}/{idx}.mp3'
            })
            t += dur + GAP
        out[nid] = {'total': round(t - GAP + TAIL, 2), 'lines': lines}

    js = _render_js(out)
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write(js)

    print(f'\n节点 {len(dump)} 个，本次合成 {len(tasks_spec)} 句（复用 {len(durations)-len(tasks_spec)} 句）')
    print(f'音频共 {total_bytes/1024:.1f} KB → {os.path.relpath(AUDIO_DIR, ROOT)}')
    print(f'时间轴 → {os.path.relpath(OUT_JS, ROOT)}')


if __name__ == '__main__':
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
