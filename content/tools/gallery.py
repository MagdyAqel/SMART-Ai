# معرض خطوات العمل في صفحة الدرس: اللقطات الحقيقية نفسها التي في فيديو الدرس، بالترتيب ومع شرح كل خطوة.
# يقرأ مشاهد اللقطات من lessons.py، ويحوّل كل لقطة إلى WebP في web/public/media/<skill>/shots/،
# ويكتب lesson.steps في skill.json (فيعرضها المتدرب تحت الفيديو ويكبّرها بالضغط).
#   python3 gallery.py            لكل الدروس
#   python3 gallery.py music-lyria
import json
import os
import subprocess
import sys

from lessons import SPECS

ROOT = os.path.join(os.path.dirname(__file__), "..")
PUBLIC = os.path.join(ROOT, "..", "web", "public")


def layers(scene):
    if scene.get("shots"):
        return scene["shots"]
    if scene.get("shot"):
        return [{"shot": scene["shot"], "caption": scene.get("caption")}]
    return []


def webp(sid, name):
    src = os.path.join(ROOT, sid, "raw", "shots", name)
    if not os.path.exists(src):
        return None
    out_dir = os.path.join(PUBLIC, "media", sid, "shots")
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.splitext(name)[0] + ".webp"
    out = os.path.join(out_dir, base)
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(src):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-c:v", "libwebp", "-lossless", "0", "-quality", "92",
                        "-compression_level", "6", out], check=True)
    w, h = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", src],
                          capture_output=True, text=True).stdout.strip().split(",")
    return f"/media/{sid}/shots/{base}", int(w), int(h)


def build(key):
    sid, spec = SPECS[key]
    lesson_id = key.split("@")[0]
    steps = []
    for sc in spec["scenes"]:
        for L in layers(sc):
            r = webp(sid, L["shot"])
            if not r:
                continue
            url, w, h = r
            steps.append({"url": url, "width": w, "height": h, "title": sc.get("title", ""),
                          "caption": L.get("caption") or sc.get("caption") or sc.get("title", "")})
    path = os.path.join(ROOT, sid, "skill.json")
    skill = json.load(open(path))
    for L in skill["lessons"]:
        if L["id"] == lesson_id:
            if steps:
                L["steps"] = steps
            else:
                L.pop("steps", None)
    json.dump(skill, open(path, "w"), ensure_ascii=False, indent=2)
    if steps:
        print(f"{sid}/{lesson_id}: {len(steps)} خطوات بالصور")


if __name__ == "__main__":
    for k in sys.argv[1:] or list(SPECS):
        build(k)
