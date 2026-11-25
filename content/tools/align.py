# محاذاة نص التعليق مع الصوت محلياً (بديل خفيف عن التفريغ الصوتي):
# نعرف النص بالضبط، فنكشف فترات الصمت في الصوت ونطابقها مع علامات الترقيم،
# ثم نوزّع الكلمات داخل كل جملة حسب طولها.
#   python3 align.py ../skill-01 lesson-what-is-ai     → raw/lesson-what-is-ai-words.json
import json
import re
import subprocess
import sys

STRONG = re.compile(r"[.؟?!:]$")
WEAK = re.compile(r"[،,؛]$")


def silences(mp3, noise="-38dB", d=0.12):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", mp3, "-af", f"silencedetect=noise={noise}:d={d}", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    dur = float(re.search(r"Duration: (\d+):(\d+):([\d.]+)", out).groups()[2]) + 60 * int(
        re.search(r"Duration: (\d+):(\d+)", out).group(2)) + 3600 * int(re.search(r"Duration: (\d+)", out).group(1))
    sil = list(zip(starts, ends + [dur] * (len(starts) - len(ends))))
    return sil, dur


def weight(tok):
    core = re.sub(r"[^\w]", "", tok)
    latin = re.sub(r"[^A-Za-z]", "", core)
    n = len(core) - len(latin)
    if latin.isupper() and len(latin) > 1:  # اختصار يُنطق حرفاً حرفاً (ADDIE، AI)
        n += 3.2 * len(latin)
    else:
        n += 1.25 * len(latin)
    return n + 1.5 + (2.5 if STRONG.search(tok) else 1.2 if WEAK.search(tok) else 0)


def spread(tokens, t0, t1):
    ws = [weight(t) for t in tokens]
    total = sum(ws)
    out, x = [], t0
    for t, w in zip(tokens, ws):
        span = (t1 - t0) * w / total
        out.append({"text": t, "start": round(x, 3), "end": round(x + span * 0.92, 3)})
        x += span
    return out


def align(text, mp3):
    sil, dur = silences(mp3)
    t0 = sil[0][1] if sil and sil[0][0] < 0.05 else 0.0
    t1 = sil[-1][0] if sil and sil[-1][1] >= dur - 0.05 else dur
    inner = [s for s in sil if s[0] > t0 + 0.05 and s[1] < t1 - 0.05]
    paras = [p.split() for p in text.strip().split("\n\n")]
    tokens = [t for p in paras for t in p]
    para_end, k = set(), -1
    for p in paras[:-1]:
        k += len(p)
        para_end.add(k)
    ws = [weight(t) for t in tokens]
    total = sum(ws)
    # الحدود المحتملة: بعد كل كلمة تنتهي بعلامة ترقيم، مع توقيتها المتوقع نسبياً
    bnds, acc = [], 0.0
    for i, (t, w) in enumerate(zip(tokens, ws)):
        acc += w
        if i < len(tokens) - 1 and (STRONG.search(t) or WEAK.search(t)):
            bnds.append((i, t0 + (t1 - t0) * acc / total, 2 if i in para_end else 1 if STRONG.search(t) else 0))
    # مطابقة مرتّبة (برمجة ديناميكية) بين الحدود والصمتات
    n, m = len(bnds), len(inner)
    INF = 1e9
    cost = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    cost[0][0] = 0.0
    skip_b = lambda k: {2: 8.0, 1: 3.0, 0: 0.8}[bnds[k][2]]
    skip_s = lambda j: 6.0 * (inner[j][1] - inner[j][0])
    for i in range(n + 1):
        for j in range(m + 1):
            c = cost[i][j]
            if c >= INF:
                continue
            if i < n and c + skip_b(i) < cost[i + 1][j]:
                cost[i + 1][j], back[i + 1][j] = c + skip_b(i), (i, j, None)
            if j < m and c + skip_s(j) < cost[i][j + 1]:
                cost[i][j + 1], back[i][j + 1] = c + skip_s(j), (i, j, None)
            if i < n and j < m:
                mid = (inner[j][0] + inner[j][1]) / 2
                mc = 0.35 * abs(bnds[i][1] - mid) - {2: 3.0, 1: 1.5, 0: 0.6}[bnds[i][2]] * min(inner[j][1] - inner[j][0], 1.0)
                if c + mc < cost[i + 1][j + 1]:
                    cost[i + 1][j + 1], back[i + 1][j + 1] = c + mc, (i, j, j)
    anchors = {}
    i, j = n, m
    while (i, j) != (0, 0):
        pi, pj, matched = back[i][j]
        if matched is not None:
            anchors[bnds[pi][0]] = inner[matched]
        i, j = pi, pj
    # توزيع الكلمات بين المراسي
    words, start, seg = [], t0, []
    for k, t in enumerate(tokens):
        seg.append(t)
        if k in anchors or k == len(tokens) - 1:
            end = anchors[k][0] if k in anchors else t1
            words += spread(seg, start, end)
            start = anchors[k][1] if k in anchors else end
            seg = []
    return words


if __name__ == "__main__":
    d, name = sys.argv[1], sys.argv[2]
    text = open(f"{d}/{name}-narration.txt").read()
    w = align(text, f"{d}/raw/{name}-narration.mp3")
    json.dump(w, open(f"{d}/raw/{name}-words.json", "w"), ensure_ascii=False)
    print(f"{name}: {len(w)} كلمة · {w[-1]['end']:.1f} ث")
