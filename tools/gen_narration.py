# tools/gen_narration.py —— 动画旁白：文字 → mp3 + 时间轴
#
# 为什么要本地预生成，而不是运行时调 TTS 插件：
#   1. 老师上课的网络不一定稳，插件那条一断就整段没声；
#   2. 预生成的音频跟着分包走，下载一次之后完全离线可用，符合「不配云也能用」的前提。
#
# 关键设计：**时间轴由音频实测时长反推**，不是反过来。
#   先合成音频 → 量出每句真实时长 → 用累加值生成 narration.js → 动画按这份时间轴走。
#   这样画面和声音天然对齐，改一句文案重跑一次就自动重排，不用手工调秒数。
#
# 用法：
#   "D:/tool/software/python/python3.10.9/python.exe" tools/gen_narration.py
#   （edge-tts 装在系统 Python 3.10.9 里，managed python 3.13 没有）
import asyncio
import json
import os
import sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'narration_src.json')
AUDIO_DIR = os.path.join(ROOT, 'miniprogram', 'assets', 'audio')
OUT_JS = os.path.join(ROOT, 'miniprogram', 'utils', 'anim', 'narration.js')

GAP = 0.18   # 句间停顿（秒）。不留间隙会连成一口气，学生跟不上
TAIL = 0.80  # 最后一句说完后画面多留一会儿，别话音一落就黑

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
        ver_bits = (data[i + 1] >> 3) & 0x03   # 3=MPEG1, 2=MPEG2, 0=MPEG2.5
        layer = (data[i + 1] >> 1) & 0x03      # 1=Layer3
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
        # 兜底：按 48kbps 估（只在解析彻底失败时走到）
        return len(data) * 8 / 48000
    return samples / rate


async def synth(text, voice, rate, out_path):
    c = edge_tts.Communicate(text, voice, rate=rate)
    await c.save(out_path)


async def main():
    with open(SRC, 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    voice = cfg.get('_voice', 'zh-CN-XiaoxiaoNeural')
    rate = cfg.get('_rate', '-6%')
    scenes = [k for k in cfg if not k.startswith('_')]

    os.makedirs(AUDIO_DIR, exist_ok=True)
    sem = asyncio.Semaphore(4)
    total_bytes = 0
    durations = {}

    tasks_spec = []
    for scene in scenes:
        d = os.path.join(AUDIO_DIR, scene)
        os.makedirs(d, exist_ok=True)
        for idx, text in enumerate(cfg[scene]):
            tasks_spec.append((scene, idx, text, os.path.join(d, f'{idx}.mp3')))

    async def one(scene, idx, text, path):
        nonlocal total_bytes
        async with sem:
            for attempt in range(3):
                try:
                    await synth(text, voice, rate, path)
                    break
                except Exception as e:
                    if attempt == 2:
                        print(f'  [FAIL] {scene}/{idx}: {e}')
                        raise
                    await asyncio.sleep(1 + attempt)
        dur = mp3_duration(path)
        total_bytes += os.path.getsize(path)
        durations[(scene, idx)] = dur
        print(f'  {scene}/{idx}.mp3  {dur:5.2f}s  {os.path.getsize(path)//1024:3d}KB  {text}')

    await asyncio.gather(*[one(*s) for s in tasks_spec])

    # 按实测时长排时间轴
    out = {}
    for scene in scenes:
        lines = []
        t = 0.0
        for idx, text in enumerate(cfg[scene]):
            dur = durations[(scene, idx)]
            lines.append({
                't': round(t, 2),
                'dur': round(dur, 2),
                'text': text,
                'file': f'{scene}/{idx}.mp3'
            })
            t += dur + GAP
        out[scene] = {'total': round(t - GAP + TAIL, 2), 'lines': lines}

    js = _render_js(out)
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write(js)

    print(f'\n音频 {len(tasks_spec)} 句，共 {total_bytes/1024:.1f} KB → {os.path.relpath(AUDIO_DIR, ROOT)}')
    for scene in scenes:
        print(f'  {scene}: {len(cfg[scene])} 句，总长 {out[scene]["total"]} 秒')
    print(f'时间轴 → {os.path.relpath(OUT_JS, ROOT)}')


def _render_js(out):
    head = ('// utils/anim/narration.js —— 动画旁白时间轴\n'
            '//\n'
            '// ⚠️ 本文件由 tools/gen_narration.py 自动生成，不要手改。\n'
            '//    改文案请改 tools/narration_src.json，然后重跑：\n'
            '//    "D:/tool/software/python/python3.10.9/python.exe" tools/gen_narration.py\n'
            '//\n'
            '// t    这句开始的时间（秒），由前面各句实测音频时长累加得出\n'
            '// dur  这句音频的真实时长（秒）\n'
            '// file 相对 miniprogram/assets/audio/ 的路径\n'
            '//\n'
            '// 场景里的动画节点用 u.cue(i) 取第 i 句的开始时间，不要写死秒数——\n'
            '// 写死的话改一句文案，画面就跟声音错开了。\n\n'
            'const NARRATION = {\n')
    body = []
    for scene, v in out.items():
        body.append(f"  {scene}: {{\n    total: {v['total']},\n    lines: [\n")
        for ln in v['lines']:
            body.append("      { t: %s, dur: %s, text: '%s', file: '%s' },\n"
                        % (ln['t'], ln['dur'], ln['text'].replace("'", "\\'"), ln['file']))
        body.append('    ]\n  },\n')
    tail = ('};\n\n'
            '// 取第 i 句的开始时间；越界时退回场景总时长，避免 NaN 传进绘制\n'
            'function cueOf(sceneId, i) {\n'
            "  const s = NARRATION[sceneId];\n"
            '  if (!s) return 0;\n'
            "  const ln = s.lines[i];\n"
            '  return ln ? ln.t : s.total;\n'
            '}\n\n'
            'function narrationOf(sceneId) {\n'
            '  return NARRATION[sceneId] || null;\n'
            '}\n\n'
            'module.exports = { NARRATION, cueOf, narrationOf };\n')
    return head + ''.join(body) + tail


if __name__ == '__main__':
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
