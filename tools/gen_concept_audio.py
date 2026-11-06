# tools/gen_concept_audio.py —— 概念卡语音：本地生成，云端托管
#
# 为什么不进小程序包：微信**单个分包上限 2048KB**，不是 20MB（20MB 是全部包总量）。
# 58 个运算节点已经吃掉 5.4MB、切成 audio1~3 三个包；428 个概念卡的 5 句语音约
# 40MB，无论怎么切都是 20 个分包，光 preload 就会拖死启动。
#
# 所以概念卡走「云存储 + 客户端下载缓存」：
#   · 本脚本把 428×5 句 mp3 生成到 cloud_assets/anim/concept/<nodeId>/<i>.mp3
#   · 你把这个目录传到微信云存储（路径保持 anim/concept/...）
#   · 客户端 audioCache.js 进到某节时按需下这 5 个小文件（约 90KB），存本地后
#     可离线复用；下载失败就退回纯字幕，功能不受影响。
#
# 索引 narration_concept.js 只存「实测时长 + 文案字数」，不存文案本身：
#   · 文案由 narration_kp.genNarration 运行时生成，改文案不用同步改索引（省 60KB）
#   · 存字数当指纹，tools/test_narration.js 会比对 —— 改了文案没重跑音频就报错
#
# 用法：
#   /d/tool/software/python/python3.10.9/python.exe tools/gen_concept_audio.py
#   （只跑缺失的；已生成且时长已缓存会跳过，可反复执行）
import asyncio
import hashlib
import json
import os
import sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMP = os.path.join(ROOT, 'tools', '_concept_narration_dump.json')
SRC = os.path.join(ROOT, 'tools', 'narration_src.json')
AUDIO_DIR = os.path.join(ROOT, 'cloud_assets', 'anim', 'concept')
OUT_JS = os.path.join(ROOT, 'miniprogram', 'utils', 'anim', 'narration_concept.js')
DUR_CACHE = os.path.join(ROOT, 'tools', '_concept_durations.json')

GAP = 0.18
TAIL = 0.80

BITRATE_V2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
BITRATE_V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
SR_V1 = [44100, 48000, 32000, 0]
SR_V2 = [22050, 24000, 16000, 0]


def mp3_duration(path):
    """逐帧解析 mp3 得到秒数（本机无 ffmpeg，只能自己读帧头）。"""
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


def _render_js(out):
    head = (
        '// utils/anim/narration_concept.js —— 概念卡语音索引（云存储，按需下载）\n'
        '//\n'
        '// ⚠️ 本文件由 tools/gen_concept_audio.py 自动生成，不要手改。\n'
        '//\n'
        '// 428 个概念卡 × 5 句 ≈ 40MB，塞不进 2048KB 单分包，所以音频托管在云存储，\n'
        '// 客户端（utils/anim/audioCache.js）进到某一节时按需下这 5 个文件并缓存本地。\n'
        '//\n'
        '// 只存时长与字数，不存文案：文案由 narration_kp.genNarration 运行时生成。\n'
        '//   t  总时长（秒，含句间停顿与尾部留白）\n'
        '//   d  每句音频实测时长（秒）\n'
        '//   n  每句文案字数（指纹，用来发现「改了文案没重跑音频」）\n'
        '//\n'
        '// 音频路径：<云端前缀>/<nodeId>/<句序号>.mp3\n\n'
        'const CONCEPT_AUDIO = {\n'
    )
    body = []
    for nid, v in out.items():
        d = ', '.join(str(x) for x in v['d'])
        n = ', '.join(str(x) for x in v['n'])
        body.append(f"  '{nid}': {{ t: {v['t']}, d: [{d}], n: [{n}] }},\n")
    tail = (
        '};\n\n'
        'function conceptAudioOf(nodeId) { return CONCEPT_AUDIO[nodeId] || null; }\n'
        'function hasConceptAudio(nodeId) { return !!CONCEPT_AUDIO[nodeId]; }\n'
        'function conceptAudioCount() { return Object.keys(CONCEPT_AUDIO).length; }\n\n'
        'module.exports = { CONCEPT_AUDIO, conceptAudioOf, hasConceptAudio, conceptAudioCount };\n'
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
    sem = asyncio.Semaphore(4)   # 并发别太高，Azure 会 429
    durations = {}
    todo = []
    reused = 0
    total_bytes = 0

    for e in dump:
        nid = e['id']
        d = os.path.join(AUDIO_DIR, nid)
        os.makedirs(d, exist_ok=True)
        for idx, text in enumerate(e['texts']):
            mp3 = os.path.join(d, '%d.mp3' % idx)
            # 缓存键带文案指纹：改了文案就自动重生成，不会留下「索引说 X 字、
            # 音频念的是旧文案」这种只能靠耳朵发现的错。
            fp = hashlib.md5(text.encode('utf-8')).hexdigest()[:10]
            key = '%s/%d/%s' % (nid, idx, fp)
            if os.path.exists(mp3) and os.path.getsize(mp3) > 1024 and key in dur_cache:
                durations[(nid, idx)] = dur_cache[key]
                total_bytes += os.path.getsize(mp3)
                reused += 1
            else:
                todo.append((nid, idx, text, mp3, key))

    print('待合成 %d 句（复用 %d 句）…' % (len(todo), reused))
    done = [0]

    async def one(nid, idx, text, mp3, key):
        nonlocal total_bytes
        async with sem:
            for attempt in range(3):
                try:
                    await synth(text, voice, rate, mp3)
                    break
                except Exception as ex:
                    if attempt == 2:
                        print('  [FAIL] %s/%d: %s' % (nid, idx, ex))
                        raise
                    await asyncio.sleep(1 + attempt * 2)
        dur = mp3_duration(mp3)
        durations[(nid, idx)] = dur
        dur_cache[key] = dur
        total_bytes += os.path.getsize(mp3)
        done[0] += 1
        if done[0] % 50 == 0:
            print('  …已合成 %d/%d' % (done[0], len(todo)))

    if todo:
        # 分批跑，避免 2000+ 协程一次性挂着（内存与连接都吃不住）
        BATCH = 120
        for s in range(0, len(todo), BATCH):
            chunk = todo[s:s + BATCH]
            await asyncio.gather(*[one(*x) for x in chunk])
            with open(DUR_CACHE, 'w', encoding='utf-8') as f:
                json.dump(dur_cache, f, ensure_ascii=False, indent=0)

    with open(DUR_CACHE, 'w', encoding='utf-8') as f:
        json.dump(dur_cache, f, ensure_ascii=False, indent=0)

    out = {}
    for e in dump:
        nid = e['id']
        ds, ns = [], []
        t = 0.0
        for idx, text in enumerate(e['texts']):
            dur = durations[(nid, idx)]
            ds.append(round(dur, 2))
            ns.append(len(text))
            t += dur + GAP
        out[nid] = {'t': round(t - GAP + TAIL, 2), 'd': ds, 'n': ns}

    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write(_render_js(out))

    print('\n节点 %d 个 / %d 句' % (len(dump), sum(len(e['texts']) for e in dump)))
    print('本次合成 %d 句，复用 %d 句' % (len(todo), reused))
    print('音频 %.1f MB → %s' % (total_bytes / 1048576.0, os.path.relpath(AUDIO_DIR, ROOT)))
    print('索引 → %s' % os.path.relpath(OUT_JS, ROOT))


if __name__ == '__main__':
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
