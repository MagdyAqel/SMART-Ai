# إطالة عرض اللقطات الحقيقية في فيديو الدرس دون تعليق صوتي جديد (بلا رصيد):
# نُدرج صمتاً قصيراً في صوت الدرس قبل ظهور كل لقطة تالية وفي نهاية مشهد اللقطات،
# ونزيح توقيت الكلمات بعده، فتبقى كل لقطة على الشاشة وقتاً أطول ليقرأها المتدرب.
# الأصل يُحفظ مرة واحدة في raw/_build/hold/، وكل تشغيل يبدأ منه (فلا يتراكم الصمت).
#   python3 hold.py ../skill-03 lesson-music-lyria [ثوانٍ=1.8]
import json
import os
import re
import shutil
import subprocess
import sys

DIAC = re.compile(r"[ً-ْٰـ]")


def norm(s):
    s = DIAC.sub("", s)
    s = re.sub("[أإآ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    s = re.sub(r"[^\w\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def find(words, phrase, lo, hi):
    target = norm(phrase).split(" ")[:3]
    for i in range(lo, hi):
        ok = True
        for k, t in enumerate(target):
            if i + k >= len(words):
                ok = False
                break
            n = norm(words[i + k]["text"])
            if not (n == t or t in n or n in t):
                ok = False
                break
        if ok:
            return i
    return -1


def main(d, name, secs=1.8):
    raw = os.path.join(d, "raw")
    bak = os.path.join(raw, "_build", "hold")
    os.makedirs(bak, exist_ok=True)
    mp3, wj = os.path.join(raw, f"{name}-narration.mp3"), os.path.join(raw, f"{name}-words.json")
    omp3, owj = os.path.join(bak, f"{name}-narration.mp3"), os.path.join(bak, f"{name}-words.json")
    mark = os.path.join(raw, f"{name}-hold.json")  # يُحفظ في المستودع: الصوت الحالي فيه وقفات
    if not os.path.exists(omp3):
        if os.path.exists(mark):
            sys.exit(f"{name}: الصوت فيه وقفات سابقة والأصل غير موجود هنا؛ لا أضيف وقفات فوقها")
        shutil.copy(mp3, omp3)
        shutil.copy(wj, owj)
    words = json.load(open(owj))
    spec = json.load(open(os.path.join(d, f"{name}.json")))
    paras = [p.split() for p in open(os.path.join(d, f"{name}-narration.txt")).read().strip().split("\n\n")]
    assert sum(map(len, paras)) == len(words), "عدد الكلمات لا يطابق النص"
    bounds, k = [], 0
    for p in paras:
        bounds.append((k, k + len(p)))
        k += len(p)

    points = []  # فهرس الكلمة التي يُدرج الصمت قبلها (len(words) = نهاية الصوت)
    for sc, (lo, hi) in zip(spec["scenes"], bounds):
        layers = sc.get("shots") or ([{"shot": sc["shot"]}] if sc.get("shot") else [])
        if not layers or not any(os.path.exists(os.path.join(raw, "shots", L["shot"])) for L in layers):
            continue
        for L in layers[1:]:
            if isinstance(L.get("at"), str):
                i = find(words, L["at"], lo, hi)
                if i > lo:
                    points.append(i)
        points.append(hi)  # نهاية المشهد: آخر لقطة تبقى أطول
    points = sorted(set(points))
    if not points:
        print(f"{name}: لا لقطات")
        return

    def gap_time(i):
        if i >= len(words):
            return words[-1]["end"] + 0.05
        prev_end = words[i - 1]["end"] if i else 0
        return (prev_end + words[i]["start"]) / 2

    cuts = [gap_time(i) for i in points]
    # بناء الصوت: مقاطع الأصل بينها صمت
    parts, inputs, t0 = [], [], 0.0
    filt = []
    for j, t in enumerate(cuts + [None]):
        seg = f"[0]atrim={t0:.3f}" + (f":{t:.3f}" if t is not None else "") + f",asetpts=N/SR/TB[s{j}]"
        filt.append(seg)
        parts.append(f"[s{j}]")
        if t is not None:
            filt.append(f"anullsrc=r=44100:cl=mono,atrim=0:{secs},asetpts=N/SR/TB[z{j}]")
            parts.append(f"[z{j}]")
            t0 = t
    filt.insert(0, "[0]aformat=sample_rates=44100:channel_layouts=mono[a0]")
    filt = [f.replace("[0]atrim", "[a0c]atrim") for f in filt]
    n = len(cuts) + 1
    filt.insert(1, f"[a0]asplit={n}" + "".join(f"[a0c{i}]" for i in range(n)))
    filt = [f.replace("[a0c]atrim", "[a0c%d]atrim" % int(re.search(r"\[s(\d+)\]", f).group(1))) if "[a0c]atrim" in f else f for f in filt]
    filt.append("".join(parts) + f"concat=n={len(parts)}:v=0:a=1[out]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", omp3, "-filter_complex", ";".join(filt), "-map", "[out]",
                    "-c:a", "libmp3lame", "-b:a", "128k", mp3], check=True)
    out = []
    for i, w in enumerate(words):
        shift = secs * sum(1 for p in points if p <= i)
        out.append({**w, "start": round(w["start"] + shift, 3), "end": round(w["end"] + shift, 3)})
    json.dump(out, open(wj, "w"), ensure_ascii=False)
    json.dump({"secs": secs, "beforeWords": points}, open(mark, "w"))
    print(f"{name}: {len(points)} وقفات × {secs} ث = +{len(points) * secs:.1f} ث")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 1.8)
